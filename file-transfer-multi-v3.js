(function () {

    'use strict';


    if (
        window.__GPT_MULTI_FILE_UPLOADER_V3__
    ) {

        return;
    }


    window.__GPT_MULTI_FILE_UPLOADER_V3__ =
        true;


    const MAX_FILE_SIZE =
        20 * 1024 * 1024;


    const MAX_TOTAL_SIZE =
        100 * 1024 * 1024;


    let selectedFiles =
        [];


    let uploadRunning =
        false;


    /* ========================================================
       BASIC
    ======================================================== */

    function byId(
        id
    ) {

        return document.getElementById(
            id
        );
    }


    function cleanUserId(
        value
    ) {

        const cleaned =
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
            cleaned ||
            'user1'
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


    function getUserId() {

        const candidates = [
            byId(
                'bridgeUserId'
            ),
            byId(
                'gptFileUserId'
            ),
            byId(
                'userId'
            )
        ];


        for (
            let i = 0;
            i < candidates.length;
            i++
        ) {

            const input =
                candidates[i];


            if (
                input &&
                input.value
            ) {

                return cleanUserId(
                    input.value
                );
            }
        }


        return cleanUserId(
            localStorage.getItem(
                'bridgeUserId'
            ) ||
            localStorage.getItem(
                'gptUserId'
            ) ||
            'user1'
        );
    }


    function getRole() {

        return (
            localStorage.getItem(
                'bridgeDeviceRole'
            ) ||
            localStorage.getItem(
                'gptFileDeviceRole'
            ) ||
            defaultRole()
        );
    }


    /* ========================================================
       SETTINGS
    ======================================================== */

    function getGithubSettings() {

        let settings =
            null;


        if (
            typeof window.getSettings ===
            'function'
        ) {

            settings =
                window.getSettings();
        }


        if (!settings) {

            settings =
                {};
        }


        function valueOf(
            id
        ) {

            const input =
                byId(
                    id
                );


            return (
                input
                    ? String(
                        input.value || ''
                    ).trim()
                    : ''
            );
        }


        return {

            owner:
                settings.owner ||
                valueOf(
                    'owner'
                ),

            repo:
                settings.repo ||
                valueOf(
                    'repo'
                ),

            branch:
                settings.branch ||
                valueOf(
                    'branch'
                ) ||
                'main',

            token:
                settings.token ||
                valueOf(
                    'token'
                ),

            userId:
                getUserId(),

            role:
                getRole()
        };
    }


    function validateSettings(
        settings
    ) {

        if (!settings.owner) {

            throw new Error(
                'GitHub Owner 설정이 없습니다.'
            );
        }


        if (!settings.repo) {

            throw new Error(
                'GitHub Repository 설정이 없습니다.'
            );
        }


        if (!settings.token) {

            throw new Error(
                'GitHub Token 설정이 없습니다.'
            );
        }
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


    /* ========================================================
       FORMAT
    ======================================================== */

    function formatBytes(
        input
    ) {

        const bytes =
            Number(
                input || 0
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


    function fileIcon(
        name
    ) {

        const lower =
            String(
                name || ''
            ).toLowerCase();


        if (
            /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/
                .test(
                    lower
                )
        ) {

            return '🖼';
        }


        if (
            /\.(zip|7z|rar|tar|gz)$/
                .test(
                    lower
                )
        ) {

            return '🗜';
        }


        if (
            /\.(xlsx|xls|csv)$/
                .test(
                    lower
                )
        ) {

            return '📊';
        }


        if (
            /\.(doc|docx|txt|md|pdf)$/
                .test(
                    lower
                )
        ) {

            return '📄';
        }


        if (
            /\.(js|ts|tsx|jsx|java|kt|py|cs|cpp|c|h|html|css|json|xml|yml|yaml)$/
                .test(
                    lower
                )
        ) {

            return '💻';
        }


        return '📎';
    }


    function safeFilename(
        name
    ) {

        const result =
            String(
                name || 'file'
            )
                .replace(
                    /[\\/:*?"<>|]/g,
                    '_'
                )
                .replace(
                    /[\u0000-\u001f]/g,
                    '_'
                )
                .trim();


        return (
            result ||
            'file'
        );
    }


    function two(
        value
    ) {

        return String(
            value
        ).padStart(
            2,
            '0'
        );
    }


    function timestampPrefix() {

        const now =
            new Date();


        return (
            now.getFullYear() +
            two(
                now.getMonth() +
                1
            ) +
            two(
                now.getDate()
            ) +
            '-' +
            two(
                now.getHours()
            ) +
            two(
                now.getMinutes()
            ) +
            two(
                now.getSeconds()
            ) +
            '-' +
            Math.random()
                .toString(
                    36
                )
                .slice(
                    2,
                    7
                )
        );
    }


    function fileKey(
        file
    ) {

        return (
            file.name +
            '|' +
            file.size +
            '|' +
            file.lastModified
        );
    }


    /* ========================================================
       BASE64
    ======================================================== */

    function arrayBufferToBase64(
        buffer
    ) {

        const bytes =
            new Uint8Array(
                buffer
            );


        const chunkSize =
            0x8000;


        let binary =
            '';


        for (
            let offset = 0;
            offset < bytes.length;
            offset += chunkSize
        ) {

            const chunk =
                bytes.subarray(
                    offset,
                    Math.min(
                        offset + chunkSize,
                        bytes.length
                    )
                );


            binary +=
                String.fromCharCode.apply(
                    null,
                    chunk
                );
        }


        return btoa(
            binary
        );
    }


    /* ========================================================
       STATUS
    ======================================================== */

    function setStatus(
        text,
        type
    ) {

        const element =
            byId(
                'gptMultiFileStatusV3'
            );


        if (!element) {

            return;
        }


        element.className =
            'multi-file-v3-status' +
            (
                type
                    ? ' ' + type
                    : ''
            );


        element.textContent =
            text || '';
    }


    function setProgress(
        percent,
        text
    ) {

        const root =
            byId(
                'gptMultiFileProgressV3'
            );


        const bar =
            byId(
                'gptMultiFileProgressBarV3'
            );


        const label =
            byId(
                'gptMultiFileProgressTextV3'
            );


        if (!root) {

            return;
        }


        root.classList.add(
            'is-visible'
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
                'gptMultiFileProgressV3'
            );


        if (root) {

            root.classList.remove(
                'is-visible'
            );
        }
    }


    /* ========================================================
       SELECTED FILES
    ======================================================== */

    function totalSelectedBytes() {

        return selectedFiles.reduce(
            function (
                total,
                item
            ) {

                return (
                    total +
                    item.file.size
                );
            },
            0
        );
    }


    function addFiles(
        fileList
    ) {

        if (uploadRunning) {

            return;
        }


        const incoming =
            Array.from(
                fileList || []
            );


        if (
            incoming.length ===
            0
        ) {

            return;
        }


        const existingKeys =
            new Set(
                selectedFiles.map(
                    function (
                        item
                    ) {

                        return fileKey(
                            item.file
                        );
                    }
                )
            );


        let duplicateCount =
            0;


        incoming.forEach(
            function (
                file
            ) {

                const key =
                    fileKey(
                        file
                    );


                if (
                    existingKeys.has(
                        key
                    )
                ) {

                    duplicateCount++;

                    return;
                }


                selectedFiles.push(
                    {
                        file:
                            file,

                        state:
                            file.size >
                            MAX_FILE_SIZE
                                ? 'invalid'
                                : 'waiting',

                        label:
                            file.size >
                            MAX_FILE_SIZE
                                ? '파일 크기 초과'
                                : '대기'
                    }
                );


                existingKeys.add(
                    key
                );
            }
        );


        render();


        const totalBytes =
            totalSelectedBytes();


        if (
            totalBytes >
            MAX_TOTAL_SIZE
        ) {

            setStatus(
                '⚠️ 전체 선택 용량이 제한을 초과했습니다.\n\n' +
                '현재: ' +
                formatBytes(
                    totalBytes
                ) +
                '\n최대: ' +
                formatBytes(
                    MAX_TOTAL_SIZE
                ),
                'warning'
            );

            return;
        }


        if (
            duplicateCount >
            0
        ) {

            setStatus(
                duplicateCount +
                '개의 중복 파일은 추가하지 않았습니다.',
                'warning'
            );

        } else {

            setStatus(
                selectedFiles.length +
                '개 파일 선택됨 · ' +
                formatBytes(
                    totalBytes
                )
            );
        }
    }


    function removeFile(
        key
    ) {

        if (uploadRunning) {

            return;
        }


        selectedFiles =
            selectedFiles.filter(
                function (
                    item
                ) {

                    return (
                        fileKey(
                            item.file
                        ) !==
                        key
                    );
                }
            );


        render();
    }


    function clearFiles() {

        if (uploadRunning) {

            return;
        }


        selectedFiles =
            [];


        const input =
            byId(
                'gptMultiFileInputV3'
            );


        if (input) {

            input.value =
                '';
        }


        render();


        setStatus(
            '선택한 파일을 모두 지웠습니다.'
        );
    }


    function updateFileState(
        file,
        state,
        label
    ) {

        const key =
            fileKey(
                file
            );


        for (
            let i = 0;
            i < selectedFiles.length;
            i++
        ) {

            const item =
                selectedFiles[i];


            if (
                fileKey(
                    item.file
                ) ===
                key
            ) {

                item.state =
                    state;


                item.label =
                    label;


                break;
            }
        }


        render();
    }


    /* ========================================================
       RENDER
    ======================================================== */

    function render() {

        const list =
            byId(
                'gptMultiFileListV3'
            );


        const summary =
            byId(
                'gptMultiFileSummaryV3'
            );


        const send =
            byId(
                'gptMultiFileSendV3'
            );


        const clear =
            byId(
                'gptMultiFileClearV3'
            );


        if (
            !list ||
            !summary ||
            !send
        ) {

            return;
        }


        list.innerHTML =
            '';


        const totalBytes =
            totalSelectedBytes();


        summary.textContent =
            selectedFiles.length +
            '개 선택 · ' +
            formatBytes(
                totalBytes
            ) +
            ' / ' +
            formatBytes(
                MAX_TOTAL_SIZE
            );


        if (
            selectedFiles.length ===
            0
        ) {

            const empty =
                document.createElement(
                    'div'
                );


            empty.className =
                'multi-file-v3-empty';


            empty.textContent =
                '선택된 파일이 없습니다.';


            list.appendChild(
                empty
            );

        } else {

            selectedFiles.forEach(
                function (
                    item
                ) {

                    const file =
                        item.file;


                    const row =
                        document.createElement(
                            'div'
                        );


                    row.className =
                        'multi-file-v3-row';


                    row.dataset.state =
                        item.state;


                    const icon =
                        document.createElement(
                            'div'
                        );


                    icon.className =
                        'multi-file-v3-icon';


                    icon.textContent =
                        fileIcon(
                            file.name
                        );


                    const main =
                        document.createElement(
                            'div'
                        );


                    main.className =
                        'multi-file-v3-main';


                    const name =
                        document.createElement(
                            'div'
                        );


                    name.className =
                        'multi-file-v3-name';


                    name.textContent =
                        file.name;


                    const meta =
                        document.createElement(
                            'div'
                        );


                    meta.className =
                        'multi-file-v3-meta';


                    meta.textContent =
                        formatBytes(
                            file.size
                        );


                    const state =
                        document.createElement(
                            'div'
                        );


                    state.className =
                        'multi-file-v3-state';


                    state.textContent =
                        item.label;


                    main.appendChild(
                        name
                    );


                    main.appendChild(
                        meta
                    );


                    main.appendChild(
                        state
                    );


                    const remove =
                        document.createElement(
                            'button'
                        );


                    remove.type =
                        'button';


                    remove.className =
                        'multi-file-v3-remove';


                    remove.textContent =
                        '×';


                    remove.disabled =
                        uploadRunning;


                    remove.addEventListener(
                        'click',
                        function (
                            event
                        ) {

                            event.preventDefault();

                            event.stopPropagation();


                            removeFile(
                                fileKey(
                                    file
                                )
                            );
                        }
                    );


                    row.appendChild(
                        icon
                    );


                    row.appendChild(
                        main
                    );


                    row.appendChild(
                        remove
                    );


                    list.appendChild(
                        row
                    );
                }
            );
        }


        const hasInvalid =
            selectedFiles.some(
                function (
                    item
                ) {

                    return (
                        item.file.size >
                        MAX_FILE_SIZE
                    );
                }
            );


        send.disabled =
            uploadRunning ||
            selectedFiles.length ===
            0 ||
            hasInvalid ||
            totalBytes >
            MAX_TOTAL_SIZE;


        send.textContent =
            uploadRunning
                ? '파일 전송 중...'
                : selectedFiles.length > 0
                    ? '선택한 ' +
                      selectedFiles.length +
                      '개 파일 전송'
                    : '파일 선택 후 전송';


        if (clear) {

            clear.disabled =
                uploadRunning ||
                selectedFiles.length ===
                0;
        }
    }


    /* ========================================================
       UPLOAD ONE FILE
    ======================================================== */

    async function uploadOne(
        file,
        index,
        total
    ) {

        const settings =
            getGithubSettings();


        validateSettings(
            settings
        );


        updateFileState(
            file,
            'reading',
            '파일 읽는 중...'
        );


        const arrayBuffer =
            await file.arrayBuffer();


        updateFileState(
            file,
            'encoding',
            'Base64 변환 중...'
        );


        const base64 =
            arrayBufferToBase64(
                arrayBuffer
            );


        updateFileState(
            file,
            'uploading',
            'GitHub 업로드 중...'
        );


        const remoteFilename =
            timestampPrefix() +
            '__' +
            safeFilename(
                file.name
            );


        const remotePath =
            outgoingDirectory(
                settings
            ) +
            '/' +
            remoteFilename;


        const body = {

            message:
                'File transfer ' +
                settings.userId +
                ' ' +
                file.name,

            content:
                base64,

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

            let message =
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

                    message =
                        data.message;
                }

            } catch {
            }


            throw new Error(
                message
            );
        }


        updateFileState(
            file,
            'success',
            '완료'
        );


        return {

            path:
                remotePath,

            name:
                remoteFilename
        };
    }


    /* ========================================================
       UPLOAD ALL
    ======================================================== */

    async function uploadAll() {

        if (uploadRunning) {

            return;
        }


        if (
            selectedFiles.length ===
            0
        ) {

            setStatus(
                '먼저 파일을 선택해주세요.',
                'warning'
            );

            return;
        }


        const totalBytes =
            totalSelectedBytes();


        if (
            totalBytes >
            MAX_TOTAL_SIZE
        ) {

            setStatus(
                '전체 선택 용량이 최대 ' +
                formatBytes(
                    MAX_TOTAL_SIZE
                ) +
                '를 초과했습니다.',
                'error'
            );

            return;
        }


        const invalid =
            selectedFiles.filter(
                function (
                    item
                ) {

                    return (
                        item.file.size >
                        MAX_FILE_SIZE
                    );
                }
            );


        if (
            invalid.length >
            0
        ) {

            setStatus(
                '파일당 최대 ' +
                formatBytes(
                    MAX_FILE_SIZE
                ) +
                '를 초과한 파일이 있습니다.',
                'error'
            );

            return;
        }


        try {

            const settings =
                getGithubSettings();


            validateSettings(
                settings
            );

        } catch (error) {

            setStatus(
                '❌ ' +
                error.message,
                'error'
            );

            return;
        }


        uploadRunning =
            true;


        render();


        setProgress(
            0,
            '전송 준비 중...'
        );


        setStatus(
            '여러 파일 전송을 시작합니다.\n\n' +
            selectedFiles.length +
            '개 · ' +
            formatBytes(
                totalBytes
            ),
            'busy'
        );


        let successCount =
            0;


        const failed =
            [];


        /*
           사용자가 전송 중 선택 목록을 바꾸지 못하므로
           시작 시점의 배열을 복사한다.
        */
        const queue =
            selectedFiles.slice();


        for (
            let i = 0;
            i < queue.length;
            i++
        ) {

            const item =
                queue[i];


            const file =
                item.file;


            const itemNumber =
                i + 1;


            setProgress(
                Math.round(
                    (
                        i /
                        queue.length
                    ) *
                    100
                ),
                itemNumber +
                ' / ' +
                queue.length +
                ' · ' +
                file.name
            );


            try {

                await uploadOne(
                    file,
                    itemNumber,
                    queue.length
                );


                successCount++;

            } catch (error) {

                failed.push(
                    {
                        name:
                            file.name,

                        error:
                            error.message
                    }
                );


                updateFileState(
                    file,
                    'failed',
                    '실패 · ' +
                    error.message
                );
            }


            setProgress(
                Math.round(
                    (
                        itemNumber /
                        queue.length
                    ) *
                    100
                ),
                itemNumber +
                ' / ' +
                queue.length +
                ' 처리 완료'
            );
        }


        uploadRunning =
            false;


        render();


        if (
            failed.length ===
            0
        ) {

            setStatus(
                '✅ 전체 파일 전송 완료\n\n' +
                '성공: ' +
                successCount +
                '개\n' +
                '총 용량: ' +
                formatBytes(
                    totalBytes
                ),
                'success'
            );

        } else {

            const errorLines =
                failed.map(
                    function (
                        item
                    ) {

                        return (
                            item.name +
                            ' : ' +
                            item.error
                        );
                    }
                );


            setStatus(
                '⚠️ 일부 파일 전송 실패\n\n' +
                '성공: ' +
                successCount +
                '개\n' +
                '실패: ' +
                failed.length +
                '개\n\n' +
                errorLines.join(
                    '\n'
                ),
                'warning'
            );
        }


        window.setTimeout(
            hideProgress,
            1800
        );


        refreshIncomingList();
    }


    /* ========================================================
       REFRESH EXISTING RECEIVED LIST
    ======================================================== */

    function refreshIncomingList() {

        const ids = [
            'gptFileRefresh',
            'fileRefresh'
        ];


        for (
            let i = 0;
            i < ids.length;
            i++
        ) {

            const button =
                byId(
                    ids[i]
                );


            if (button) {

                window.setTimeout(
                    function () {

                        button.click();

                    },
                    500
                );


                return;
            }
        }
    }


    /* ========================================================
       HIDE LEGACY SINGLE UPLOAD UI
    ======================================================== */

    function hideLegacyUploader() {

        const legacyInput =
            byId(
                'gptFileInput'
            );


        const legacySend =
            byId(
                'gptFileSend'
            );


        /*
           input 자체만 숨기면 기존 Drop Zone이 남을 수 있으므로
           알려진 업로드 전용 요소도 같이 처리한다.
           받은 파일 목록은 절대 숨기지 않는다.
        */
        if (legacyInput) {

            legacyInput.classList.add(
                'gpt-multi-v3-hidden'
            );


            const labels =
                document.querySelectorAll(
                    'label[for="gptFileInput"]'
                );


            labels.forEach(
                function (
                    label
                ) {

                    label.classList.add(
                        'gpt-multi-v3-hidden'
                    );
                }
            );
        }


        if (legacySend) {

            legacySend.classList.add(
                'gpt-multi-v3-hidden'
            );
        }


        const knownLegacyIds = [
            'gptFileDropZone',
            'gptFileSelected',
            'gptFileSelectedFile',
            'gptFileSelectedInfo'
        ];


        knownLegacyIds.forEach(
            function (
                id
            ) {

                const element =
                    byId(
                        id
                    );


                if (element) {

                    element.classList.add(
                        'gpt-multi-v3-hidden'
                    );
                }
            }
        );
    }


    /* ========================================================
       CREATE UI
    ======================================================== */

    function createUploader() {

        if (
            byId(
                'gptMultiFileUploaderV3'
            )
        ) {

            return true;
        }


        const fileMode =
            byId(
                'gptFileMode'
            );


        if (!fileMode) {

            return false;
        }


        const panel =
            document.createElement(
                'section'
            );


        panel.id =
            'gptMultiFileUploaderV3';


        panel.innerHTML =
            [
                '<div class="multi-file-v3-header">',

                '  <div class="multi-file-v3-title">',
                '    📎 여러 파일 보내기',
                '  </div>',

                '  <div class="multi-file-v3-badge">',
                '    MULTI',
                '  </div>',

                '</div>',


                '<input',
                '  id="gptMultiFileInputV3"',
                '  type="file"',
                '  multiple',
                '>',


                '<div',
                '  id="gptMultiFileDropV3"',
                '  class="multi-file-v3-drop-zone"',
                '  role="button"',
                '  tabindex="0"',
                '>',

                '  <div class="multi-file-v3-drop-icon">',
                '    📂',
                '  </div>',

                '  <div class="multi-file-v3-drop-title">',
                '    파일 여러 개 선택',
                '  </div>',

                '  <div class="multi-file-v3-drop-sub">',
                '    휴대폰/PC에서 여러 파일을 한 번에 선택하거나 드래그하세요.',
                '    <br>',
                '    파일당 최대 20 MB · 선택 합계 최대 100 MB',
                '  </div>',

                '</div>',


                '<div class="multi-file-v3-summary">',

                '  <div',
                '    id="gptMultiFileSummaryV3"',
                '    class="multi-file-v3-summary-text"',
                '  >',
                '    0개 선택 · 0 B',
                '  </div>',

                '  <button',
                '    id="gptMultiFileClearV3"',
                '    class="multi-file-v3-clear"',
                '    type="button"',
                '    disabled',
                '  >',
                '    전체 지우기',
                '  </button>',

                '</div>',


                '<div',
                '  id="gptMultiFileListV3"',
                '  class="multi-file-v3-list"',
                '></div>',


                '<button',
                '  id="gptMultiFileSendV3"',
                '  class="multi-file-v3-send"',
                '  type="button"',
                '  disabled',
                '>',
                '  파일 선택 후 전송',
                '</button>',


                '<div',
                '  id="gptMultiFileProgressV3"',
                '  class="multi-file-v3-progress"',
                '>',

                '  <div class="multi-file-v3-progress-track">',

                '    <div',
                '      id="gptMultiFileProgressBarV3"',
                '      class="multi-file-v3-progress-bar"',
                '    ></div>',

                '  </div>',

                '  <div',
                '    id="gptMultiFileProgressTextV3"',
                '    class="multi-file-v3-progress-text"',
                '  ></div>',

                '</div>',


                '<div',
                '  id="gptMultiFileStatusV3"',
                '  class="multi-file-v3-status"',
                '></div>'
            ].join(
                '\n'
            );


        /*
           클립보드 이미지 패널이 있으면 그 뒤에 배치.
           없으면 파일 전송 화면의 앞쪽에 배치.
        */
        const clipboardPanel =
            byId(
                'clipboardImagePanel'
            );


        if (
            clipboardPanel &&
            clipboardPanel.parentNode ===
            fileMode
        ) {

            clipboardPanel.insertAdjacentElement(
                'afterend',
                panel
            );

        } else {

            fileMode.insertBefore(
                panel,
                fileMode.firstChild
            );
        }


        const input =
            byId(
                'gptMultiFileInputV3'
            );


        const drop =
            byId(
                'gptMultiFileDropV3'
            );


        const send =
            byId(
                'gptMultiFileSendV3'
            );


        const clear =
            byId(
                'gptMultiFileClearV3'
            );


        drop.addEventListener(
            'click',
            function () {

                if (!uploadRunning) {

                    input.click();
                }
            }
        );


        drop.addEventListener(
            'keydown',
            function (
                event
            ) {

                if (
                    event.key ===
                    'Enter' ||
                    event.key ===
                    ' '
                ) {

                    event.preventDefault();


                    if (!uploadRunning) {

                        input.click();
                    }
                }
            }
        );


        input.addEventListener(
            'change',
            function () {

                addFiles(
                    input.files
                );


                /*
                   같은 파일을 다시 선택할 수 있도록 초기화
                */
                input.value =
                    '';
            }
        );


        [
            'dragenter',
            'dragover'
        ].forEach(
            function (
                eventName
            ) {

                drop.addEventListener(
                    eventName,
                    function (
                        event
                    ) {

                        event.preventDefault();

                        event.stopPropagation();


                        drop.classList.add(
                            'is-dragging'
                        );
                    }
                );
            }
        );


        [
            'dragleave',
            'dragend',
            'drop'
        ].forEach(
            function (
                eventName
            ) {

                drop.addEventListener(
                    eventName,
                    function (
                        event
                    ) {

                        event.preventDefault();

                        event.stopPropagation();


                        drop.classList.remove(
                            'is-dragging'
                        );
                    }
                );
            }
        );


        drop.addEventListener(
            'drop',
            function (
                event
            ) {

                if (
                    uploadRunning ||
                    !event.dataTransfer
                ) {

                    return;
                }


                addFiles(
                    event.dataTransfer.files
                );
            }
        );


        send.addEventListener(
            'click',
            uploadAll
        );


        clear.addEventListener(
            'click',
            clearFiles
        );


        render();


        hideLegacyUploader();


        return true;
    }


    /* ========================================================
       INIT
    ======================================================== */

    let attempt =
        0;


    const initTimer =
        window.setInterval(
            function () {

                attempt++;


                if (
                    createUploader() ||
                    attempt >= 200
                ) {

                    window.clearInterval(
                        initTimer
                    );
                }

            },
            100
        );


    /*
       다른 모듈 렌더 이후 기존 단일 UI가 다시 보이는 경우 대비.
    */
    window.setTimeout(
        hideLegacyUploader,
        1500
    );


    window.setTimeout(
        hideLegacyUploader,
        3500
    );

})();