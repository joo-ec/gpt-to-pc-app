(function () {

    'use strict';


    if (window.__GPT_FILE_DOWNLOAD_ALL__) {
        return;
    }

    window.__GPT_FILE_DOWNLOAD_ALL__ = true;


    const AUTO_DELETE_KEY =
        'gptFileAutoDeleteAfterDownload';


    let currentFiles = [];
    let running = false;
    let refreshTimer = null;


    const byId = function (id) {
        return document.getElementById(id);
    };


    /* ========================================================
       USER / ROLE
    ======================================================== */

    function cleanUserId(value) {

        const result =
            String(value || 'user1')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9._-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^[-.]+|[-.]+$/g, '');

        return result || 'user1';
    }


    function getUserId() {

        const input =
            byId('bridgeUserId');

        return cleanUserId(
            input
                ? input.value
                : localStorage.getItem('bridgeUserId')
        );
    }


    function defaultRole() {

        return /Android|iPhone|iPad|Mobile/i
            .test(navigator.userAgent)
                ? 'phone'
                : 'pc';
    }


    function getRole() {

        return (
            localStorage.getItem('bridgeDeviceRole') ||
            defaultRole()
        );
    }


    function getSettings() {

        if (typeof window.getSettings !== 'function') {

            throw new Error(
                '기존 GitHub 설정 기능을 찾지 못했습니다.'
            );
        }

        const settings =
            window.getSettings();

        settings.userId =
            getUserId();

        settings.role =
            getRole();

        return settings;
    }


    function incomingDirectory(settings) {

        return (
            'users/' +
            settings.userId +
            '/files/' +
            (
                settings.role === 'phone'
                    ? 'pc-to-phone'
                    : 'phone-to-pc'
            )
        );
    }


    /* ========================================================
       UTILS
    ======================================================== */

    function displayFilename(value) {

        return String(value || '')
            .replace(
                /^\d{8}-\d{6}__/,
                ''
            );
    }


    function formatBytes(value) {

        const bytes =
            Number(value || 0);

        if (bytes < 1024) {
            return bytes + ' B';
        }

        if (bytes < 1024 * 1024) {

            return (
                (bytes / 1024).toFixed(1) +
                ' KB'
            );
        }

        return (
            (
                bytes /
                1024 /
                1024
            ).toFixed(2) +
            ' MB'
        );
    }


    function pad2(value) {

        return String(value)
            .padStart(2, '0');
    }


    function zipFilename() {

        const now =
            new Date();

        return (
            'received-files-' +
            now.getFullYear() +
            pad2(now.getMonth() + 1) +
            pad2(now.getDate()) +
            '-' +
            pad2(now.getHours()) +
            pad2(now.getMinutes()) +
            pad2(now.getSeconds()) +
            '.zip'
        );
    }


    function wait(ms) {

        return new Promise(
            function (resolve) {
                window.setTimeout(resolve, ms);
            }
        );
    }


    function isAutoDeleteEnabled() {

        return (
            localStorage.getItem(
                AUTO_DELETE_KEY
            ) === '1'
        );
    }


    /* ========================================================
       GITHUB
    ======================================================== */

    function githubHeaders(token) {

        return {
            Accept:
                'application/vnd.github+json',

            Authorization:
                'Bearer ' + token,

            'X-GitHub-Api-Version':
                '2022-11-28'
        };
    }


    function apiUrl(settings, path) {

        return (
            'https://api.github.com/repos/' +
            encodeURIComponent(settings.owner) +
            '/' +
            encodeURIComponent(settings.repo) +
            '/contents/' +
            path
                .split('/')
                .map(encodeURIComponent)
                .join('/')
        );
    }


    async function listIncomingFiles() {

        const settings =
            getSettings();

        const directory =
            incomingDirectory(settings);

        const response =
            await fetch(
                apiUrl(
                    settings,
                    directory
                ) +
                '?ref=' +
                encodeURIComponent(
                    settings.branch
                ) +
                '&_=' +
                Date.now(),
                {
                    cache:
                        'no-store',

                    headers:
                        githubHeaders(
                            settings.token
                        )
                }
            );

        if (response.status === 404) {
            return [];
        }

        if (!response.ok) {

            throw new Error(
                '파일 목록 조회 실패: ' +
                response.status
            );
        }

        const result =
            await response.json();

        if (!Array.isArray(result)) {
            return [];
        }

        return result
            .filter(
                function (item) {
                    return item.type === 'file';
                }
            )
            .sort(
                function (a, b) {

                    return String(b.name)
                        .localeCompare(
                            String(a.name)
                        );
                }
            );
    }


    async function downloadRemoteFile(
        settings,
        file
    ) {

        const response =
            await fetch(
                apiUrl(
                    settings,
                    file.path
                ) +
                '?ref=' +
                encodeURIComponent(
                    settings.branch
                ),
                {
                    cache:
                        'no-store',

                    headers: {
                        Authorization:
                            'Bearer ' +
                            settings.token,

                        Accept:
                            'application/vnd.github.raw',

                        'X-GitHub-Api-Version':
                            '2022-11-28'
                    }
                }
            );

        if (!response.ok) {

            throw new Error(
                '파일 수신 실패 (' +
                response.status +
                ')'
            );
        }

        const buffer =
            await response.arrayBuffer();

        if (
            buffer.byteLength === 0 &&
            Number(file.size || 0) > 0
        ) {

            throw new Error(
                '수신된 파일 크기가 0입니다.'
            );
        }

        return new Uint8Array(buffer);
    }


    async function deleteRemoteFile(
        settings,
        file
    ) {

        const response =
            await fetch(
                apiUrl(
                    settings,
                    file.path
                ),
                {
                    method:
                        'DELETE',

                    headers: {
                        ...githubHeaders(
                            settings.token
                        ),

                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify({
                            message:
                                'Auto delete ZIP downloaded file ' +
                                displayFilename(
                                    file.name
                                ),

                            sha:
                                file.sha,

                            branch:
                                settings.branch
                        })
                }
            );

        if (!response.ok) {

            let detail =
                response.status +
                ' ' +
                response.statusText;

            try {

                const data =
                    await response.json();

                if (data && data.message) {
                    detail = data.message;
                }

            } catch (ignore) {
            }

            throw new Error(detail);
        }
    }


    /* ========================================================
       UI
    ======================================================== */

    function setResult(
        text,
        type
    ) {

        const target =
            byId(
                'gptFileDownloadAllResult'
            );

        if (!target) {
            return;
        }

        target.className =
            'file-download-all-result' +
            (
                type
                    ? ' ' + type
                    : ''
            );

        target.textContent =
            text || '';
    }


    function setProgress(
        percent,
        text
    ) {

        const root =
            byId(
                'gptFileDownloadAllProgress'
            );

        const bar =
            byId(
                'gptFileDownloadAllProgressBar'
            );

        const label =
            byId(
                'gptFileDownloadAllProgressText'
            );

        if (!root) {
            return;
        }

        root.classList.add(
            'visible'
        );

        if (bar) {

            bar.style.width =
                Math.max(
                    0,
                    Math.min(
                        100,
                        percent
                    )
                ) +
                '%';
        }

        if (label) {
            label.textContent =
                text || '';
        }
    }


    function hideProgress() {

        const root =
            byId(
                'gptFileDownloadAllProgress'
            );

        if (root) {
            root.classList.remove(
                'visible'
            );
        }
    }


    function updateAutoDeleteInfo() {

        const target =
            byId(
                'gptFileDownloadAllAutoDelete'
            );

        if (!target) {
            return;
        }

        const enabled =
            isAutoDeleteEnabled();

        target.classList.toggle(
            'on',
            enabled
        );

        target.textContent =
            enabled
                ? '⚠ 자동삭제 ON · ZIP 다운로드 시작 후 포함된 원격 파일도 삭제됩니다.'
                : '자동삭제 OFF · ZIP 다운로드 후에도 원격 파일을 유지합니다.';
    }


    function renderSummary() {

        const summary =
            byId(
                'gptFileDownloadAllSummary'
            );

        const button =
            byId(
                'gptFileDownloadAllButton'
            );

        const totalBytes =
            currentFiles.reduce(
                function (sum, file) {

                    return (
                        sum +
                        Number(
                            file.size || 0
                        )
                    );
                },
                0
            );

        if (summary) {

            summary.textContent =
                currentFiles.length
                    .toLocaleString() +
                '개 · ' +
                formatBytes(totalBytes);
        }

        if (button) {

            button.disabled =
                running ||
                currentFiles.length === 0;

            button.textContent =
                running
                    ? '전체 파일 처리 중...'
                    : currentFiles.length > 0
                        ? '📦 전체 ' +
                          currentFiles.length +
                          '개 ZIP 다운로드'
                        : '📦 전체 ZIP 다운로드';
        }

        updateAutoDeleteInfo();
    }


    /* ========================================================
       ZIP DOWNLOAD
    ======================================================== */

    async function downloadAll() {

        if (running) {
            return;
        }

        try {

            if (
                typeof window.fflate ===
                'undefined'
            ) {

                throw new Error(
                    'ZIP 라이브러리를 불러오지 못했습니다. 페이지를 새로고침해주세요.'
                );
            }


            running = true;
            renderSummary();


            setResult(
                '받은 파일 목록을 다시 확인합니다...',
                'busy'
            );


            currentFiles =
                await listIncomingFiles();


            renderSummary();


            if (currentFiles.length === 0) {

                setResult(
                    '다운로드할 받은 파일이 없습니다.',
                    'warning'
                );

                return;
            }


            const settings =
                getSettings();


            /*
             * fflate zipSync에 전달할 파일 Map.
             *
             * 같은 표시 파일명이 존재할 경우 ZIP 내부에서
             * 충돌하지 않도록 번호를 붙인다.
             */
            const zipFiles = {};

            const usedNames =
                new Set();

            const downloadedFiles = [];


            for (
                let i = 0;
                i < currentFiles.length;
                i++
            ) {

                const file =
                    currentFiles[i];

                const displayName =
                    displayFilename(
                        file.name
                    ) ||
                    file.name;

                let zipName =
                    displayName;

                let duplicateIndex =
                    2;


                while (
                    usedNames.has(
                        zipName.toLowerCase()
                    )
                ) {

                    const dot =
                        displayName.lastIndexOf('.');

                    if (dot > 0) {

                        zipName =
                            displayName.substring(
                                0,
                                dot
                            ) +
                            ' (' +
                            duplicateIndex +
                            ')' +
                            displayName.substring(
                                dot
                            );

                    } else {

                        zipName =
                            displayName +
                            ' (' +
                            duplicateIndex +
                            ')';
                    }

                    duplicateIndex++;
                }


                usedNames.add(
                    zipName.toLowerCase()
                );


                setProgress(
                    Math.round(
                        (
                            i /
                            currentFiles.length
                        ) *
                        85
                    ),
                    (
                        i + 1
                    ) +
                    ' / ' +
                    currentFiles.length +
                    ' 다운로드 중 · ' +
                    displayName
                );


                setResult(
                    '전체 파일 다운로드 중...\n\n' +
                    (
                        i + 1
                    ) +
                    ' / ' +
                    currentFiles.length +
                    '\n' +
                    displayName,
                    'busy'
                );


                try {

                    const bytes =
                        await downloadRemoteFile(
                            settings,
                            file
                        );

                    zipFiles[zipName] =
                        bytes;

                    downloadedFiles.push(
                        file
                    );

                } catch (error) {

                    throw new Error(
                        displayName +
                        ' 다운로드 실패\n' +
                        error.message +
                        '\n\nZIP 생성은 중단되었습니다. 원격 파일은 삭제하지 않았습니다.'
                    );
                }
            }


            setProgress(
                90,
                'ZIP 파일 생성 중...'
            );


            setResult(
                '모든 파일 수신 완료\nZIP 생성 중...',
                'busy'
            );


            /*
             * level 0:
             * 이미 ZIP/JPG/PNG/PDF 등 압축된 파일이 섞여 있는
             * 파일 전송 용도이므로 재압축에 CPU를 많이 쓰지 않는다.
             *
             * ZIP 하나로 묶는 것이 목적.
             */
            const zipped =
                window.fflate.zipSync(
                    zipFiles,
                    {
                        level: 0
                    }
                );


            const blob =
                new Blob(
                    [zipped],
                    {
                        type:
                            'application/zip'
                    }
                );


            const objectUrl =
                URL.createObjectURL(
                    blob
                );


            const name =
                zipFilename();


            const link =
                document.createElement(
                    'a'
                );


            link.href =
                objectUrl;

            link.download =
                name;

            link.style.display =
                'none';


            document.body.appendChild(
                link
            );

            link.click();

            link.remove();


            window.setTimeout(
                function () {

                    URL.revokeObjectURL(
                        objectUrl
                    );

                },
                10000
            );


            setProgress(
                100,
                'ZIP 다운로드 시작'
            );


            /*
             * 브라우저에서는 실제 OS 다운로드 저장 완료 여부까지
             * 확인할 수 없다.
             *
             * 기존 개별 다운로드 자동삭제 정책과 동일하게
             * Blob 생성 성공 + 브라우저 다운로드 시작 이후를
             * 성공 시점으로 사용한다.
             */
            if (
                isAutoDeleteEnabled()
            ) {

                setResult(
                    '✅ ZIP 다운로드 시작\n\n' +
                    name +
                    '\n' +
                    formatBytes(blob.size) +
                    '\n\n원격 파일 자동 삭제 중...',
                    'busy'
                );


                const deleteFailed =
                    [];


                for (
                    let i = 0;
                    i < downloadedFiles.length;
                    i++
                ) {

                    const file =
                        downloadedFiles[i];


                    setProgress(
                        Math.round(
                            85 +
                            (
                                (
                                    i + 1
                                ) /
                                downloadedFiles.length
                            ) *
                            15
                        ),
                        (
                            i + 1
                        ) +
                        ' / ' +
                        downloadedFiles.length +
                        ' 원격 파일 삭제 중 · ' +
                        displayFilename(
                            file.name
                        )
                    );


                    try {

                        await deleteRemoteFile(
                            settings,
                            file
                        );

                    } catch (error) {

                        deleteFailed.push(
                            displayFilename(
                                file.name
                            ) +
                            ' : ' +
                            error.message
                        );
                    }


                    await wait(120);
                }


                if (
                    deleteFailed.length ===
                    0
                ) {

                    setResult(
                        '✅ 전체 ZIP 다운로드 시작\n\n' +
                        name +
                        '\n' +
                        downloadedFiles.length +
                        '개 · ' +
                        formatBytes(blob.size) +
                        '\n\n원격 파일 전체 삭제 완료',
                        'success'
                    );

                } else {

                    setResult(
                        '⚠️ ZIP 다운로드는 시작되었습니다.\n\n' +
                        '원격 삭제 성공: ' +
                        (
                            downloadedFiles.length -
                            deleteFailed.length
                        ) +
                        '개\n' +
                        '원격 삭제 실패: ' +
                        deleteFailed.length +
                        '개\n\n' +
                        deleteFailed.join('\n'),
                        'warning'
                    );
                }


                triggerExistingRefresh();

            } else {

                setResult(
                    '✅ 전체 ZIP 다운로드 시작\n\n' +
                    name +
                    '\n' +
                    downloadedFiles.length +
                    '개 · ' +
                    formatBytes(blob.size),
                    'success'
                );
            }


        } catch (error) {

            setResult(
                '❌ 전체 다운로드 실패\n\n' +
                error.message,
                'error'
            );

        } finally {

            running = false;

            renderSummary();

            window.setTimeout(
                hideProgress,
                2200
            );
        }
    }


    /* ========================================================
       EXISTING FILE LIST SYNC
    ======================================================== */

    function triggerExistingRefresh() {

        const button =
            byId(
                'gptFileRefresh'
            );

        if (button) {

            window.setTimeout(
                function () {
                    button.click();
                },
                300
            );
        }

        window.setTimeout(
            refreshOwnList,
            650
        );
    }


    async function refreshOwnList() {

        if (running) {
            return;
        }

        try {

            currentFiles =
                await listIncomingFiles();

            renderSummary();

        } catch (ignore) {
        }
    }


    /* ========================================================
       CREATE UI
    ======================================================== */

    function createPanel() {

        if (
            byId(
                'gptFileDownloadAllPanel'
            )
        ) {

            return true;
        }


        const accordion =
            byId(
                'gptFileReceivedAccordion'
            );


        if (!accordion) {
            return false;
        }


        const body =
            accordion.querySelector(
                '.file-accordion-body'
            );


        if (!body) {
            return false;
        }


        const panel =
            document.createElement(
                'div'
            );


        panel.id =
            'gptFileDownloadAllPanel';

        panel.className =
            'file-download-all-panel';


        panel.innerHTML =
            [
                '<div class="file-download-all-summary">',

                '  <div',
                '    id="gptFileDownloadAllSummary"',
                '    class="file-download-all-info"',
                '  >',
                '    파일 확인 중...',
                '  </div>',

                '</div>',


                '<button',
                '  id="gptFileDownloadAllButton"',
                '  class="blue file-download-all-button"',
                '  type="button"',
                '  disabled',
                '>',
                '  📦 전체 ZIP 다운로드',
                '</button>',


                '<div',
                '  id="gptFileDownloadAllAutoDelete"',
                '  class="file-download-all-auto-delete"',
                '></div>',


                '<div',
                '  id="gptFileDownloadAllProgress"',
                '  class="file-download-all-progress"',
                '>',

                '  <div',
                '    class="file-download-all-progress-track"',
                '  >',

                '    <div',
                '      id="gptFileDownloadAllProgressBar"',
                '      class="file-download-all-progress-bar"',
                '    ></div>',

                '  </div>',

                '  <div',
                '    id="gptFileDownloadAllProgressText"',
                '    class="file-download-all-progress-text"',
                '  ></div>',

                '</div>',


                '<div',
                '  id="gptFileDownloadAllResult"',
                '  class="file-download-all-result"',
                '></div>'
            ].join('\n');


        /*
         * 전체 삭제/자동삭제 패널 바로 앞에 배치.
         * 삭제 모듈이 아직 생성되지 않았다면 받은 파일 목록
         * 다음에 배치한다.
         */
        const cleanupPanel =
            byId(
                'gptFileCleanupPanel'
            );


        if (
            cleanupPanel &&
            cleanupPanel.parentNode === body
        ) {

            body.insertBefore(
                panel,
                cleanupPanel
            );

        } else {

            const list =
                byId(
                    'gptFileList'
                );

            if (
                list &&
                list.parentNode === body
            ) {

                list.insertAdjacentElement(
                    'afterend',
                    panel
                );

            } else {

                body.appendChild(
                    panel
                );
            }
        }


        byId(
            'gptFileDownloadAllButton'
        ).addEventListener(
            'click',
            downloadAll
        );


        /*
         * 기존 자동삭제 체크박스 변경을 즉시 반영.
         */
        const autoDelete =
            byId(
                'gptFileAutoDelete'
            );

        if (autoDelete) {

            autoDelete.addEventListener(
                'change',
                updateAutoDeleteInfo
            );
        }


        updateAutoDeleteInfo();

        refreshOwnList();


        /*
         * 기존 파일 목록이 바뀌면 전체 다운로드 요약도 갱신.
         */
        const list =
            byId(
                'gptFileList'
            );

        if (
            list &&
            typeof MutationObserver !==
            'undefined'
        ) {

            const observer =
                new MutationObserver(
                    function () {

                        if (!running) {

                            window.clearTimeout(
                                refreshTimer
                            );

                            refreshTimer =
                                window.setTimeout(
                                    refreshOwnList,
                                    250
                                );
                        }
                    }
                );


            observer.observe(
                list,
                {
                    childList:
                        true
                }
            );
        }


        return true;
    }


    /* ========================================================
       INIT
    ======================================================== */

    let attempts = 0;


    const initTimer =
        window.setInterval(
            function () {

                attempts++;


                if (
                    createPanel() ||
                    attempts >= 200
                ) {

                    window.clearInterval(
                        initTimer
                    );
                }

            },
            100
        );


    /*
     * 역할 변경 시 수신 폴더가 반대로 바뀌므로 갱신.
     */
    document.addEventListener(
        'click',
        function (event) {

            const target =
                event.target;

            if (!target) {
                return;
            }

            if (
                target.id === 'gptFileRolePhone' ||
                target.id === 'gptFileRolePc'
            ) {

                window.setTimeout(
                    refreshOwnList,
                    250
                );
            }
        }
    );

})();