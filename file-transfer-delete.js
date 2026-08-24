(function () {

    'use strict';


    if (
        window.__GPT_FILE_CLEANUP_MODULE__
    ) {

        return;
    }


    window.__GPT_FILE_CLEANUP_MODULE__ =
        true;


    const AUTO_DELETE_KEY =
        'gptFileAutoDeleteAfterDownload';


    let latestFiles =
        [];


    let decorateTimer =
        null;


    let decorating =
        false;


    const byId =
        function (id) {

            return document.getElementById(
                id
            );
        };


    /* ========================================================
       USER / ROLE
    ======================================================== */

    function cleanUserId(
        value
    ) {

        let result =
            String(
                value || 'user1'
            )
                .trim()
                .toLowerCase()
                .replace(
                    /[^a-z0-9._-]/g,
                    '-'
                )
                .replace(
                    /-+/g,
                    '-'
                )
                .replace(
                    /^[-.]+|[-.]+$/g,
                    ''
                );


        return (
            result ||
            'user1'
        );
    }


    function getUserId() {

        const input =
            byId(
                'bridgeUserId'
            );


        return cleanUserId(
            input
                ? input.value
                : localStorage.getItem(
                    'bridgeUserId'
                )
        );
    }


    function defaultRole() {

        return (
            /Android|iPhone|iPad|Mobile/i
                .test(
                    navigator.userAgent
                )
                ? 'phone'
                : 'pc'
        );
    }


    function getRole() {

        return (
            localStorage.getItem(
                'bridgeDeviceRole'
            ) ||
            defaultRole()
        );
    }


    function getSettings() {

        if (
            typeof window.getSettings !==
            'function'
        ) {

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


    function incomingDirectory(
        settings
    ) {

        return (
            'users/' +
            settings.userId +
            '/files/' +
            (
                settings.role ===
                'phone'
                    ? 'pc-to-phone'
                    : 'phone-to-pc'
            )
        );
    }


    /* ========================================================
       UTILS
    ======================================================== */

    function displayFilename(
        value
    ) {

        return String(
            value || ''
        ).replace(
            /^\d{8}-\d{6}__/,
            ''
        );
    }


    function formatBytes(
        value
    ) {

        const bytes =
            Number(
                value || 0
            );


        if (bytes < 1024) {

            return (
                bytes +
                ' B'
            );
        }


        if (
            bytes <
            1024 * 1024
        ) {

            return (
                (
                    bytes /
                    1024
                ).toFixed(
                    1
                ) +
                ' KB'
            );
        }


        return (
            (
                bytes /
                1024 /
                1024
            ).toFixed(
                2
            ) +
            ' MB'
        );
    }


    function setStatus(
        text
    ) {

        const target =
            byId(
                'gptFileStatus'
            );


        if (target) {

            target.textContent =
                text;
        }
    }


    function wait(
        ms
    ) {

        return new Promise(
            function (resolve) {

                setTimeout(
                    resolve,
                    ms
                );
            }
        );
    }


    /* ========================================================
       GITHUB
    ======================================================== */

    function githubHeaders(
        token
    ) {

        return {

            Accept:
                'application/vnd.github+json',

            Authorization:
                'Bearer ' +
                token,

            'X-GitHub-Api-Version':
                '2022-11-28'
        };
    }


    function apiUrl(
        settings,
        path
    ) {

        return (
            'https://api.github.com/repos/' +
            encodeURIComponent(
                settings.owner
            ) +
            '/' +
            encodeURIComponent(
                settings.repo
            ) +
            '/contents/' +
            path
                .split('/')
                .map(
                    encodeURIComponent
                )
                .join('/')
        );
    }


    async function listIncomingFiles() {

        const settings =
            getSettings();


        const directory =
            incomingDirectory(
                settings
            );


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


        if (
            response.status ===
            404
        ) {

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


        if (
            !Array.isArray(
                result
            )
        ) {

            return [];
        }


        return result
            .filter(
                function (item) {

                    return (
                        item.type ===
                        'file'
                    );
                }
            )
            .sort(
                function (a, b) {

                    return String(
                        b.name
                    ).localeCompare(
                        String(
                            a.name
                        )
                    );
                }
            );
    }


    async function deleteRemoteFile(
        file,
        message
    ) {

        const settings =
            getSettings();


        const body = {

            message:
                message ||
                (
                    'Delete transferred file ' +
                    file.name
                ),

            sha:
                file.sha,

            branch:
                settings.branch
        };


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
                        JSON.stringify(
                            body
                        )
                }
            );


        if (!response.ok) {

            let detail =
                response.status +
                ' ' +
                response.statusText;


            try {

                const error =
                    await response.json();


                if (
                    error &&
                    error.message
                ) {

                    detail =
                        error.message;
                }

            } catch {
            }


            throw new Error(
                detail
            );
        }


        return await response.json();
    }


    /* ========================================================
       REFRESH EXISTING FILE LIST
    ======================================================== */

    function triggerExistingRefresh() {

        const button =
            byId(
                'gptFileRefresh'
            );


        if (button) {

            button.click();
        }


        scheduleDecoration(
            800
        );
    }


    /* ========================================================
       SINGLE DELETE
    ======================================================== */

    async function deleteSingleFile(
        file
    ) {

        const name =
            displayFilename(
                file.name
            );


        const ok =
            window.confirm(
                '이 파일을 삭제할까요?\n\n' +
                name +
                '\n' +
                formatBytes(
                    file.size
                ) +
                '\n\nGitHub 저장소에서 삭제됩니다.'
            );


        if (!ok) {

            return;
        }


        try {

            setStatus(
                '파일 삭제 중...\n\n' +
                name
            );


            await deleteRemoteFile(
                file,
                'Delete transferred file ' +
                name
            );


            setStatus(
                '✅ 파일 삭제 완료\n\n' +
                name
            );


            await wait(
                350
            );


            triggerExistingRefresh();

        } catch (error) {

            setStatus(
                '❌ 파일 삭제 실패\n\n' +
                name +
                '\n\n' +
                error.message
            );
        }
    }


    /* ========================================================
       DELETE ALL
    ======================================================== */

    async function deleteAllFiles() {

        try {

            const files =
                await listIncomingFiles();


            if (
                files.length ===
                0
            ) {

                setStatus(
                    '삭제할 받은 파일이 없습니다.'
                );

                return;
            }


            const totalBytes =
                files.reduce(
                    function (
                        sum,
                        file
                    ) {

                        return (
                            sum +
                            Number(
                                file.size || 0
                            )
                        );
                    },
                    0
                );


            const ok =
                window.confirm(
                    '받은 파일을 모두 삭제할까요?\n\n' +
                    files.length +
                    '개 · ' +
                    formatBytes(
                        totalBytes
                    ) +
                    '\n\n이 작업은 현재 받은 파일 폴더의 파일을 모두 삭제합니다.'
                );


            if (!ok) {

                return;
            }


            const button =
                byId(
                    'gptFileDeleteAll'
                );


            if (button) {

                button.classList.add(
                    'file-cleanup-busy'
                );
            }


            let success =
                0;


            const failed =
                [];


            for (
                let i = 0;
                i < files.length;
                i++
            ) {

                const file =
                    files[i];


                setStatus(
                    '전체 삭제 중...\n\n' +
                    (
                        i + 1
                    ) +
                    ' / ' +
                    files.length +
                    '\n' +
                    displayFilename(
                        file.name
                    )
                );


                try {

                    await deleteRemoteFile(
                        file,
                        'Delete transferred file ' +
                        displayFilename(
                            file.name
                        )
                    );


                    success++;

                } catch (error) {

                    failed.push(
                        displayFilename(
                            file.name
                        ) +
                        ' : ' +
                        error.message
                    );
                }


                await wait(
                    180
                );
            }


            if (button) {

                button.classList.remove(
                    'file-cleanup-busy'
                );
            }


            if (
                failed.length ===
                0
            ) {

                setStatus(
                    '✅ 받은 파일 전체 삭제 완료\n\n' +
                    success +
                    '개'
                );

            } else {

                setStatus(
                    '⚠️ 전체 삭제 일부 실패\n\n' +
                    '성공: ' +
                    success +
                    '개\n' +
                    '실패: ' +
                    failed.length +
                    '개\n\n' +
                    failed.join(
                        '\n'
                    )
                );
            }


            await wait(
                350
            );


            triggerExistingRefresh();

        } catch (error) {

            setStatus(
                '❌ 전체 삭제 실패\n\n' +
                error.message
            );


            const button =
                byId(
                    'gptFileDeleteAll'
                );


            if (button) {

                button.classList.remove(
                    'file-cleanup-busy'
                );
            }
        }
    }


    /* ========================================================
       AUTO DELETE
    ======================================================== */

    function isAutoDeleteEnabled() {

        return (
            localStorage.getItem(
                AUTO_DELETE_KEY
            ) === '1'
        );
    }


    function setAutoDeleteEnabled(
        enabled
    ) {

        localStorage.setItem(
            AUTO_DELETE_KEY,
            enabled
                ? '1'
                : '0'
        );


        updateAutoDeleteState();
    }


    function updateAutoDeleteState() {

        const checkbox =
            byId(
                'gptFileAutoDelete'
            );


        const state =
            byId(
                'gptFileAutoDeleteState'
            );


        if (checkbox) {

            checkbox.checked =
                isAutoDeleteEnabled();
        }


        if (state) {

            state.textContent =
                isAutoDeleteEnabled()
                    ? '현재 ON · 다운로드 시작 후 원격 파일을 자동 삭제합니다.'
                    : '현재 OFF · 다운로드해도 원격 파일을 유지합니다.';
        }
    }


    /* ========================================================
       ENHANCED DOWNLOAD
    ======================================================== */

    async function downloadAndMaybeDelete(
        file
    ) {

        const name =
            displayFilename(
                file.name
            );


        try {

            const settings =
                getSettings();


            setStatus(
                '파일 다운로드 중...\n\n' +
                name
            );


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
                    'GitHub 파일 수신 실패: ' +
                    response.status
                );
            }


            const blob =
                await response.blob();


            if (
                blob.size === 0 &&
                Number(
                    file.size || 0
                ) > 0
            ) {

                throw new Error(
                    '수신된 파일 크기가 0입니다.'
                );
            }


            const objectUrl =
                URL.createObjectURL(
                    blob
                );


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
                2000
            );


            if (
                isAutoDeleteEnabled()
            ) {

                setStatus(
                    '✅ 파일 수신 완료 / 다운로드 시작\n\n' +
                    name +
                    '\n\n원격 파일 자동 삭제 중...'
                );


                await wait(
                    500
                );


                await deleteRemoteFile(
                    file,
                    'Auto delete downloaded file ' +
                    name
                );


                setStatus(
                    '✅ 다운로드 시작 + 원격 파일 삭제 완료\n\n' +
                    name
                );


                await wait(
                    350
                );


                triggerExistingRefresh();

            } else {

                setStatus(
                    '✅ 다운로드 시작\n\n' +
                    name +
                    '\n' +
                    formatBytes(
                        file.size
                    )
                );
            }

        } catch (error) {

            setStatus(
                '❌ 다운로드 실패\n\n' +
                name +
                '\n\n' +
                error.message
            );
        }
    }


    /* ========================================================
       DECORATE EXISTING FILE LIST
    ======================================================== */

    async function decorateFileList() {

        if (decorating) {

            return;
        }


        const list =
            byId(
                'gptFileList'
            );


        if (!list) {

            return;
        }


        decorating =
            true;


        try {

            latestFiles =
                await listIncomingFiles();


            const items =
                Array.from(
                    list.querySelectorAll(
                        '.file-item'
                    )
                );


            items.forEach(
                function (
                    item,
                    index
                ) {

                    const file =
                        latestFiles[
                            index
                        ];


                    if (!file) {

                        return;
                    }


                    item.dataset.remotePath =
                        file.path;


                    item.dataset.remoteSha =
                        file.sha;


                    item.dataset.remoteName =
                        file.name;


                    item.dataset.remoteSize =
                        String(
                            file.size || 0
                        );


                    let download =
                        item.querySelector(
                            '.file-download-button'
                        );


                    if (!download) {

                        return;
                    }


                    let actions =
                        item.querySelector(
                            '.file-cleanup-actions'
                        );


                    if (!actions) {

                        actions =
                            document.createElement(
                                'div'
                            );


                        actions.className =
                            'file-cleanup-actions';


                        download.parentNode.insertBefore(
                            actions,
                            download
                        );


                        actions.appendChild(
                            download
                        );
                    }


                    if (
                        !item.querySelector(
                            '.file-delete-button'
                        )
                    ) {

                        const deleteButton =
                            document.createElement(
                                'button'
                            );


                        deleteButton.type =
                            'button';


                        deleteButton.className =
                            'file-delete-button';


                        deleteButton.textContent =
                            '삭제';


                        deleteButton.addEventListener(
                            'click',
                            function (
                                event
                            ) {

                                event.preventDefault();

                                event.stopPropagation();


                                deleteSingleFile(
                                    file
                                );
                            }
                        );


                        actions.appendChild(
                            deleteButton
                        );
                    }
                }
            );

        } catch (error) {

            console.warn(
                'File cleanup decoration failed:',
                error
            );

        } finally {

            decorating =
                false;
        }
    }


    function scheduleDecoration(
        delay
    ) {

        if (decorateTimer) {

            clearTimeout(
                decorateTimer
            );
        }


        decorateTimer =
            setTimeout(
                decorateFileList,
                delay || 250
            );
    }


    /* ========================================================
       INTERCEPT EXISTING DOWNLOAD BUTTON
    ======================================================== */

    document.addEventListener(
        'click',
        function (event) {

            const download =
                event.target.closest(
                    '#gptFileMode .file-download-button'
                );


            if (!download) {

                return;
            }


            const item =
                download.closest(
                    '.file-item'
                );


            if (
                !item ||
                !item.dataset.remotePath ||
                !item.dataset.remoteSha
            ) {

                return;
            }


            event.preventDefault();

            event.stopPropagation();

            event.stopImmediatePropagation();


            const file = {

                path:
                    item.dataset.remotePath,

                sha:
                    item.dataset.remoteSha,

                name:
                    item.dataset.remoteName,

                size:
                    Number(
                        item.dataset.remoteSize || 0
                    )
            };


            downloadAndMaybeDelete(
                file
            );

        },
        true
    );


    /* ========================================================
       CREATE CLEANUP UI
    ======================================================== */

    function createCleanupUi() {

        const fileMode =
            byId(
                'gptFileMode'
            );


        const accordionBody =
            document.querySelector(
                '#gptFileReceivedAccordion .file-accordion-body'
            );


        if (
            !fileMode ||
            !accordionBody
        ) {

            return false;
        }


        if (
            byId(
                'gptFileCleanupPanel'
            )
        ) {

            return true;
        }


        const panel =
            document.createElement(
                'div'
            );


        panel.id =
            'gptFileCleanupPanel';


        panel.className =
            'file-cleanup-panel';


        panel.innerHTML =
            [
                '<label class="file-auto-delete-option">',

                '  <input',
                '    id="gptFileAutoDelete"',
                '    type="checkbox"',
                '  >',

                '  <span class="file-auto-delete-main">',

                '    <div class="file-auto-delete-title">',
                '      다운로드 후 원격 파일 자동 삭제',
                '    </div>',

                '    <div class="file-auto-delete-description">',
                '      GitHub에서 파일 데이터를 정상적으로 받은 뒤 다운로드가 시작되면 원격 파일을 삭제합니다.',
                '    </div>',

                '    <div',
                '      id="gptFileAutoDeleteState"',
                '      class="file-auto-delete-state"',
                '    ></div>',

                '  </span>',

                '</label>',

                '<button',
                '  id="gptFileDeleteAll"',
                '  class="file-delete-all"',
                '  type="button"',
                '>',
                '  받은 파일 전체 삭제',
                '</button>'
            ].join(
                '\n'
            );


        accordionBody.appendChild(
            panel
        );


        byId(
            'gptFileAutoDelete'
        ).addEventListener(
            'change',
            function () {

                setAutoDeleteEnabled(
                    this.checked
                );


                setStatus(
                    this.checked
                        ? '자동 삭제를 켰습니다.\n다운로드 시작 후 원격 파일이 삭제됩니다.'
                        : '자동 삭제를 껐습니다.\n다운로드한 파일도 원격에 유지됩니다.'
                );
            }
        );


        byId(
            'gptFileDeleteAll'
        ).addEventListener(
            'click',
            deleteAllFiles
        );


        updateAutoDeleteState();


        /* ----------------------------------------------------
           기존 파일 목록 변화 감시
        ---------------------------------------------------- */

        const list =
            byId(
                'gptFileList'
            );


        if (list) {

            const observer =
                new MutationObserver(
                    function () {

                        scheduleDecoration(
                            250
                        );
                    }
                );


            observer.observe(
                list,
                {
                    childList:
                        true,

                    subtree:
                        true
                }
            );
        }


        scheduleDecoration(
            300
        );


        return true;
    }


    /* ========================================================
       ROLE / REFRESH EVENTS
    ======================================================== */

    document.addEventListener(
        'click',
        function (event) {

            if (
                event.target.closest(
                    '#gptFileRolePhone'
                ) ||
                event.target.closest(
                    '#gptFileRolePc'
                ) ||
                event.target.closest(
                    '#gptFileRefresh'
                ) ||
                event.target.closest(
                    '#gptFileModeButton'
                )
            ) {

                scheduleDecoration(
                    700
                );
            }

        }
    );


    /* ========================================================
       INIT
    ======================================================== */

    let attempts =
        0;


    const initTimer =
        setInterval(
            function () {

                attempts++;


                if (
                    createCleanupUi() ||
                    attempts >= 150
                ) {

                    clearInterval(
                        initTimer
                    );
                }

            },
            100
        );

})();