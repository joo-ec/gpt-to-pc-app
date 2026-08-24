(function () {

    'use strict';


    if (
        window.__GPT_FILE_TRANSFER_V1__
    ) {

        return;
    }


    window.__GPT_FILE_TRANSFER_V1__ =
        true;


    const MAX_FILE_SIZE =
        20 * 1024 * 1024;


    let selectedFile =
        null;


    let refreshTimer =
        null;


    const byId =
        function (id) {

            return document.getElementById(
                id
            );
        };


    /* ========================================================
       HELPERS
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


    function setRole(
        role
    ) {

        localStorage.setItem(
            'bridgeDeviceRole',
            role
        );


        updateRoleUi();


        refreshFiles(
            true
        );
    }


    function getSettings() {

        if (
            typeof window.getSettings !==
            'function'
        ) {

            throw new Error(
                '기존 GitHub 설정을 찾지 못했습니다.'
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


    function outgoingDirectory(
        settings
    ) {

        return (
            'users/' +
            settings.userId +
            '/files/' +
            (
                settings.role ===
                'phone'
                    ? 'phone-to-pc'
                    : 'pc-to-phone'
            )
        );
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


    function safeFilename(
        value
    ) {

        let name =
            String(
                value || 'file'
            )
                .replace(
                    /[\\/:*?"<>|]/g,
                    '_'
                )
                .replace(
                    /\s+/g,
                    ' '
                )
                .trim();


        if (!name) {

            name =
                'file';
        }


        return name;
    }


    function timestampPrefix() {

        const now =
            new Date();


        const pad =
            function (value) {

                return String(
                    value
                ).padStart(
                    2,
                    '0'
                );
            };


        return (
            now.getFullYear() +
            pad(
                now.getMonth() + 1
            ) +
            pad(
                now.getDate()
            ) +
            '-' +
            pad(
                now.getHours()
            ) +
            pad(
                now.getMinutes()
            ) +
            pad(
                now.getSeconds()
            )
        );
    }


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


    function iconForFile(
        name
    ) {

        const lower =
            String(
                name || ''
            ).toLowerCase();


        if (
            lower.endsWith('.zip') ||
            lower.endsWith('.7z') ||
            lower.endsWith('.rar')
        ) {

            return '🗜️';
        }


        if (
            lower.endsWith('.json') ||
            lower.endsWith('.js') ||
            lower.endsWith('.ts') ||
            lower.endsWith('.tsx') ||
            lower.endsWith('.java') ||
            lower.endsWith('.ps1')
        ) {

            return '💻';
        }


        if (
            lower.endsWith('.png') ||
            lower.endsWith('.jpg') ||
            lower.endsWith('.jpeg') ||
            lower.endsWith('.webp')
        ) {

            return '🖼️';
        }


        if (
            lower.endsWith('.xlsx') ||
            lower.endsWith('.xls') ||
            lower.endsWith('.csv')
        ) {

            return '📊';
        }


        if (
            lower.endsWith('.pdf')
        ) {

            return '📕';
        }


        return '📄';
    }


    /* ========================================================
       STATUS
    ======================================================== */

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


    function setProgress(
        percent,
        text
    ) {

        const wrapper =
            byId(
                'gptFileProgress'
            );


        const bar =
            byId(
                'gptFileProgressBar'
            );


        const label =
            byId(
                'gptFileProgressText'
            );


        if (!wrapper) {
            return;
        }


        wrapper.classList.add(
            'visible'
        );


        bar.style.width =
            Math.max(
                0,
                Math.min(
                    100,
                    percent
                )
            ) +
            '%';


        label.textContent =
            text || '';
    }


    function hideProgress() {

        const wrapper =
            byId(
                'gptFileProgress'
            );


        if (wrapper) {

            wrapper.classList.remove(
                'visible'
            );
        }
    }


    /* ========================================================
       GITHUB
    ======================================================== */

    function headers(
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


    async function arrayBufferToBase64(
        buffer
    ) {

        const bytes =
            new Uint8Array(
                buffer
            );


        let binary =
            '';


        const chunk =
            0x8000;


        for (
            let offset = 0;
            offset < bytes.length;
            offset += chunk
        ) {

            binary +=
                String.fromCharCode.apply(
                    null,
                    bytes.subarray(
                        offset,
                        offset + chunk
                    )
                );


            if (
                offset %
                (
                    chunk * 32
                ) === 0
            ) {

                await new Promise(
                    function (resolve) {

                        setTimeout(
                            resolve,
                            0
                        );
                    }
                );
            }
        }


        return btoa(
            binary
        );
    }


    async function uploadFile() {

        try {

            if (!selectedFile) {

                throw new Error(
                    '전송할 파일을 선택하세요.'
                );
            }


            if (
                selectedFile.size >
                MAX_FILE_SIZE
            ) {

                throw new Error(
                    '파일이 너무 큽니다.\n\n' +
                    'V1 최대 크기: ' +
                    formatBytes(
                        MAX_FILE_SIZE
                    ) +
                    '\n현재 파일: ' +
                    formatBytes(
                        selectedFile.size
                    )
                );
            }


            const settings =
                getSettings();


            const remoteName =
                timestampPrefix() +
                '__' +
                safeFilename(
                    selectedFile.name
                );


            const remotePath =
                outgoingDirectory(
                    settings
                ) +
                '/' +
                remoteName;


            setStatus(
                '파일 읽는 중...\n\n' +
                selectedFile.name
            );


            setProgress(
                15,
                '파일 읽는 중...'
            );


            const buffer =
                await selectedFile
                    .arrayBuffer();


            setProgress(
                35,
                'Base64 변환 중...'
            );


            const content =
                await arrayBufferToBase64(
                    buffer
                );


            setProgress(
                65,
                'GitHub로 업로드 중...'
            );


            const body = {

                message:
                    'GPT File Transfer ' +
                    settings.userId +
                    ' ' +
                    new Date()
                        .toISOString(),

                content:
                    content,

                branch:
                    settings.branch
            };


            const response =
                await fetch(
                    apiUrl(
                        settings,
                        remotePath
                    ),
                    {
                        method:
                            'PUT',

                        headers: {

                            ...headers(
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

                    const data =
                        await response.json();


                    if (
                        data &&
                        data.message
                    ) {

                        detail =
                            data.message;
                    }

                } catch {
                }


                throw new Error(
                    'GitHub 업로드 실패\n' +
                    detail
                );
            }


            setProgress(
                100,
                '업로드 완료'
            );


            setStatus(
                '✅ 파일 전송 완료\n\n' +
                (
                    settings.role ===
                    'phone'
                        ? '휴대폰 → PC'
                        : 'PC → 휴대폰'
                ) +
                '\n\n' +
                selectedFile.name +
                '\n' +
                formatBytes(
                    selectedFile.size
                )
            );


            window.setTimeout(
                hideProgress,
                1200
            );

        } catch (error) {

            hideProgress();


            setStatus(
                '❌ 파일 전송 실패\n\n' +
                error.message
            );
        }
    }


    /* ========================================================
       DIRECTORY LIST
    ======================================================== */

    async function readIncomingFiles(
        settings
    ) {

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
                        headers(
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


    function renderFileList(
        files
    ) {

        const list =
            byId(
                'gptFileList'
            );


        const count =
            byId(
                'gptFileReceivedCount'
            );


        list.innerHTML =
            '';


        count.textContent =
            files.length
                .toLocaleString() +
            '개';


        if (
            files.length ===
            0
        ) {

            const empty =
                document.createElement(
                    'div'
                );


            empty.className =
                'file-empty';


            empty.textContent =
                '아직 받은 파일이 없습니다.';


            list.appendChild(
                empty
            );


            return;
        }


        files.forEach(
            function (file) {

                const item =
                    document.createElement(
                        'div'
                    );


                item.className =
                    'file-item';


                const icon =
                    document.createElement(
                        'div'
                    );


                icon.className =
                    'file-item-icon';


                icon.textContent =
                    iconForFile(
                        file.name
                    );


                const main =
                    document.createElement(
                        'div'
                    );


                main.className =
                    'file-item-main';


                const name =
                    document.createElement(
                        'div'
                    );


                name.className =
                    'file-item-name';


                name.textContent =
                    displayFilename(
                        file.name
                    );


                const meta =
                    document.createElement(
                        'div'
                    );


                meta.className =
                    'file-item-meta';


                meta.textContent =
                    formatBytes(
                        file.size
                    );


                main.appendChild(
                    name
                );


                main.appendChild(
                    meta
                );


                const download =
                    document.createElement(
                        'button'
                    );


                download.type =
                    'button';


                download.className =
                    'blue file-download-button';


                download.textContent =
                    '다운로드';


                download.addEventListener(
                    'click',
                    function () {

                        downloadFile(
                            file
                        );
                    }
                );


                item.appendChild(
                    icon
                );


                item.appendChild(
                    main
                );


                item.appendChild(
                    download
                );


                list.appendChild(
                    item
                );
            }
        );
    }


    /* ========================================================
       BINARY DOWNLOAD
    ======================================================== */

    async function downloadFile(
        file
    ) {

        try {

            const settings =
                getSettings();


            setStatus(
                '파일 다운로드 준비 중...\n\n' +
                displayFilename(
                    file.name
                )
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
                    'GitHub 다운로드 실패: ' +
                    response.status
                );
            }


            const blob =
                await response.blob();


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
                displayFilename(
                    file.name
                );


            link.style.display =
                'none';


            document.body.appendChild(
                link
            );


            link.click();


            link.remove();


            setTimeout(
                function () {

                    URL.revokeObjectURL(
                        objectUrl
                    );

                },
                1500
            );


            setStatus(
                '✅ 다운로드 시작\n\n' +
                displayFilename(
                    file.name
                ) +
                '\n' +
                formatBytes(
                    file.size
                )
            );

        } catch (error) {

            setStatus(
                '❌ 다운로드 실패\n\n' +
                error.message
            );
        }
    }


    /* ========================================================
       REFRESH
    ======================================================== */

    async function refreshFiles(
        manual
    ) {

        try {

            const settings =
                getSettings();


            if (manual) {

                setStatus(
                    '받은 파일 목록 확인 중...'
                );
            }


            const files =
                await readIncomingFiles(
                    settings
                );


            renderFileList(
                files
            );


            if (manual) {

                setStatus(
                    '✅ 파일 목록 확인 완료\n\n' +
                    files.length
                        .toLocaleString() +
                    '개'
                );
            }

        } catch (error) {

            if (manual) {

                setStatus(
                    '❌ 파일 목록 확인 실패\n\n' +
                    error.message
                );
            }
        }
    }


    /* ========================================================
       SELECT FILE
    ======================================================== */

    function selectFile(
        file
    ) {

        selectedFile =
            file || null;


        const box =
            byId(
                'gptFileSelected'
            );


        if (!selectedFile) {

            box.classList.remove(
                'visible'
            );


            return;
        }


        byId(
            'gptFileSelectedIcon'
        ).textContent =
            iconForFile(
                selectedFile.name
            );


        byId(
            'gptFileSelectedName'
        ).textContent =
            selectedFile.name;


        byId(
            'gptFileSelectedSize'
        ).textContent =
            formatBytes(
                selectedFile.size
            ) +
            (
                selectedFile.size >
                MAX_FILE_SIZE
                    ? ' · 최대 용량 초과'
                    : ''
            );


        box.classList.add(
            'visible'
        );


        if (
            selectedFile.size >
            MAX_FILE_SIZE
        ) {

            setStatus(
                '⚠️ 선택한 파일이 V1 최대 크기보다 큽니다.\n\n' +
                selectedFile.name +
                '\n' +
                formatBytes(
                    selectedFile.size
                ) +
                '\n\n최대: ' +
                formatBytes(
                    MAX_FILE_SIZE
                )
            );

        } else {

            setStatus(
                '파일 선택 완료\n\n' +
                selectedFile.name +
                '\n' +
                formatBytes(
                    selectedFile.size
                )
            );
        }
    }


    /* ========================================================
       ROLE UI
    ======================================================== */

    function updateRoleUi() {

        const role =
            getRole();


        const phone =
            byId(
                'gptFileRolePhone'
            );


        const pc =
            byId(
                'gptFileRolePc'
            );


        if (!phone || !pc) {
            return;
        }


        phone.className =
            role ===
            'phone'
                ? 'selected'
                : 'unselected';


        pc.className =
            role ===
            'pc'
                ? 'selected'
                : 'unselected';


        const settings = {

            userId:
                getUserId(),

            role:
                role
        };


        byId(
            'gptFilePathInfo'
        ).textContent =
            '보내는 경로\n' +
            outgoingDirectory(
                settings
            ) +
            '/\n\n받는 경로\n' +
            incomingDirectory(
                settings
            ) +
            '/';
    }


    /* ========================================================
       MODE
    ======================================================== */

    function hideFileMode() {

        const mode =
            byId(
                'gptFileMode'
            );


        if (mode) {

            mode.classList.remove(
                'file-mode-visible'
            );
        }


        const tab =
            byId(
                'gptFileModeButton'
            );


        if (tab) {

            tab.className =
                'inactive';
        }
    }


    function showFileMode() {

        const ids = [
            'sendMode',
            'receiveMode'
        ];


        ids.forEach(
            function (id) {

                const element =
                    byId(
                        id
                    );


                if (element) {

                    element.classList.add(
                        'hidden'
                    );
                }
            }
        );


        const textMode =
            byId(
                'gptTextMode'
            );


        if (textMode) {

            textMode.classList.remove(
                'gpt-text-visible'
            );
        }


        const analysisMode =
            byId(
                'gptAnalysisMode'
            );


        if (analysisMode) {

            analysisMode.classList.remove(
                'analysis-visible'
            );
        }


        byId(
            'gptFileMode'
        ).classList.add(
            'file-mode-visible'
        );


        document
            .querySelectorAll(
                '.modebar button'
            )
            .forEach(
                function (button) {

                    button.className =
                        button.id ===
                        'gptFileModeButton'
                            ? 'active'
                            : 'inactive';
                }
            );


        const subtitle =
            byId(
                'subtitle'
            );


        if (subtitle) {

            subtitle.textContent =
                '휴대폰과 PC 사이에서 파일을 양방향으로 전달합니다.';
        }


        const url =
            new URL(
                location.href
            );


        url.searchParams.set(
            'mode',
            'file'
        );


        history.replaceState(
            {},
            '',
            url
        );


        updateRoleUi();


        refreshFiles(
            true
        );


        if (refreshTimer) {

            clearInterval(
                refreshTimer
            );
        }


        refreshTimer =
            setInterval(
                function () {

                    const mode =
                        byId(
                            'gptFileMode'
                        );


                    if (
                        mode &&
                        mode.classList.contains(
                            'file-mode-visible'
                        )
                    ) {

                        refreshFiles(
                            false
                        );
                    }

                },
                10000
            );
    }


    /* ========================================================
       CREATE UI
    ======================================================== */

    function createUi() {

        const modebar =
            document.querySelector(
                '.modebar'
            );


        if (!modebar) {

            return false;
        }


        if (
            byId(
                'gptFileModeButton'
            ) ||
            byId(
                'gptFileMode'
            )
        ) {

            return true;
        }


        modebar.classList.add(
            'gpt-file-tabs-enabled'
        );


        const tab =
            document.createElement(
                'button'
            );


        tab.id =
            'gptFileModeButton';


        tab.type =
            'button';


        tab.className =
            'inactive';


        tab.textContent =
            '파일 전송';


        tab.addEventListener(
            'click',
            showFileMode
        );


        modebar.appendChild(
            tab
        );


        const mode =
            document.createElement(
                'div'
            );


        mode.id =
            'gptFileMode';


        mode.innerHTML = [

            '<div class="card file-transfer-card">',

            '  <div class="file-transfer-title">',
            '    파일 전송',
            '  </div>',

            '  <div class="file-transfer-description">',
            '    ZIP, JSON, 문서, 이미지 등 일반 파일을 휴대폰과 PC 사이에서 전달합니다.',
            '  </div>',

            '  <label>',
            '    이 기기의 역할',
            '  </label>',

            '  <div class="file-role">',

            '    <button',
            '      id="gptFileRolePhone"',
            '      type="button"',
            '    >',
            '      📱 휴대폰',
            '    </button>',

            '    <button',
            '      id="gptFileRolePc"',
            '      type="button"',
            '    >',
            '      💻 PC',
            '    </button>',

            '  </div>',

            '  <div',
            '    id="gptFilePathInfo"',
            '    class="file-path-info"',
            '  ></div>',

            '</div>',


            '<div class="card file-transfer-card">',

            '  <label>',
            '    상대방에게 보낼 파일',
            '  </label>',

            '  <input',
            '    id="gptFileInput"',
            '    type="file"',
            '  >',

            '  <div',
            '    id="gptFileDropZone"',
            '    class="file-drop-zone"',
            '  >',

            '    <div class="file-drop-icon">',
            '      📎',
            '    </div>',

            '    <div class="file-drop-title">',
            '      파일 선택',
            '    </div>',

            '    <div class="file-drop-sub">',
            '      누르거나 파일을 끌어놓으세요 · 최대 20MB',
            '    </div>',

            '  </div>',

            '  <div',
            '    id="gptFileSelected"',
            '    class="file-selected"',
            '  >',

            '    <div',
            '      id="gptFileSelectedIcon"',
            '      class="file-selected-icon"',
            '    >',
            '      📄',
            '    </div>',

            '    <div class="file-selected-body">',

            '      <div',
            '        id="gptFileSelectedName"',
            '        class="file-selected-name"',
            '      ></div>',

            '      <div',
            '        id="gptFileSelectedSize"',
            '        class="file-selected-size"',
            '      ></div>',

            '    </div>',

            '  </div>',

            '  <div',
            '    id="gptFileProgress"',
            '    class="file-progress"',
            '  >',

            '    <div class="file-progress-track">',
            '      <div',
            '        id="gptFileProgressBar"',
            '        class="file-progress-bar"',
            '      ></div>',
            '    </div>',

            '    <div',
            '      id="gptFileProgressText"',
            '      class="file-progress-text"',
            '    ></div>',

            '  </div>',

            '  <button',
            '    id="gptFileSend"',
            '    class="green"',
            '    type="button"',
            '  >',
            '    상대방에게 파일 보내기',
            '  </button>',

            '</div>',


            '<div',
            '  id="gptFileReceivedAccordion"',
            '  class="file-accordion open"',
            '>',

            '  <button',
            '    id="gptFileReceivedHeader"',
            '    class="file-accordion-header"',
            '    type="button"',
            '  >',

            '    <span>',
            '      📥 받은 파일',
            '    </span>',

            '    <span>',

            '      <span',
            '        id="gptFileReceivedCount"',
            '        class="file-received-count"',
            '      >',
            '        0개',
            '      </span>',

            '      <span class="file-arrow">',
            '        ▼',
            '      </span>',

            '    </span>',

            '  </button>',

            '  <div class="file-accordion-body">',

            '    <div',
            '      id="gptFileList"',
            '      class="file-list"',
            '    >',

            '      <div class="file-empty">',
            '        받은 파일 확인 중...',
            '      </div>',

            '    </div>',

            '    <button',
            '      id="gptFileRefresh"',
            '      class="blue"',
            '      type="button"',
            '    >',
            '      파일 목록 새로고침',
            '    </button>',

            '  </div>',

            '</div>',


            '<div class="card">',

            '  <div',
            '    id="gptFileStatus"',
            '    class="file-status"',
            '  >',
            '    파일 전송 준비됨',
            '  </div>',

            '</div>'

        ].join(
            '\n'
        );


        const analysisMode =
            byId(
                'gptAnalysisMode'
            );


        if (analysisMode) {

            analysisMode.insertAdjacentElement(
                'afterend',
                mode
            );

        } else {

            const textMode =
                byId(
                    'gptTextMode'
                );


            if (textMode) {

                textMode.insertAdjacentElement(
                    'afterend',
                    mode
                );

            } else {

                modebar.insertAdjacentElement(
                    'afterend',
                    mode
                );
            }
        }


        /* ----------------------------------------------------
           EVENTS
        ---------------------------------------------------- */

        byId(
            'gptFileRolePhone'
        ).addEventListener(
            'click',
            function () {

                setRole(
                    'phone'
                );
            }
        );


        byId(
            'gptFileRolePc'
        ).addEventListener(
            'click',
            function () {

                setRole(
                    'pc'
                );
            }
        );


        const input =
            byId(
                'gptFileInput'
            );


        const drop =
            byId(
                'gptFileDropZone'
            );


        drop.addEventListener(
            'click',
            function () {

                input.click();
            }
        );


        input.addEventListener(
            'change',
            function () {

                selectFile(
                    input.files &&
                    input.files.length
                        ? input.files[0]
                        : null
                );
            }
        );


        drop.addEventListener(
            'dragover',
            function (event) {

                event.preventDefault();


                drop.classList.add(
                    'dragover'
                );
            }
        );


        drop.addEventListener(
            'dragleave',
            function () {

                drop.classList.remove(
                    'dragover'
                );
            }
        );


        drop.addEventListener(
            'drop',
            function (event) {

                event.preventDefault();


                drop.classList.remove(
                    'dragover'
                );


                if (
                    event.dataTransfer &&
                    event.dataTransfer.files &&
                    event.dataTransfer.files.length
                ) {

                    selectFile(
                        event.dataTransfer.files[0]
                    );
                }
            }
        );


        byId(
            'gptFileSend'
        ).addEventListener(
            'click',
            uploadFile
        );


        byId(
            'gptFileRefresh'
        ).addEventListener(
            'click',
            function () {

                refreshFiles(
                    true
                );
            }
        );


        byId(
            'gptFileReceivedHeader'
        ).addEventListener(
            'click',
            function () {

                byId(
                    'gptFileReceivedAccordion'
                ).classList.toggle(
                    'open'
                );
            }
        );


        /* ----------------------------------------------------
           다른 탭 누르면 파일 화면 숨김
        ---------------------------------------------------- */

        modebar.addEventListener(
            'click',
            function (event) {

                const button =
                    event.target.closest(
                        'button'
                    );


                if (
                    button &&
                    button.id !==
                    'gptFileModeButton'
                ) {

                    hideFileMode();
                }

            },
            true
        );


        updateRoleUi();


        const requested =
            new URLSearchParams(
                location.search
            ).get(
                'mode'
            );


        if (
            requested ===
            'file'
        ) {

            showFileMode();
        }


        return true;
    }


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
                    createUi() ||
                    attempts >= 100
                ) {

                    clearInterval(
                        initTimer
                    );
                }

            },
            100
        );

})();