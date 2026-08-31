(function () {

    'use strict';


    if (
        window.__GPT_CLIPBOARD_IMAGE_TRANSFER__
    ) {

        return;
    }


    window.__GPT_CLIPBOARD_IMAGE_TRANSFER__ =
        true;


    const MAX_IMAGE_SIZE =
        15 * 1024 * 1024;


    let currentBlob =
        null;


    let currentObjectUrl =
        null;


    let currentWidth =
        0;


    let currentHeight =
        0;


    let currentMime =
        'image/png';


    /* ========================================================
       DOM
    ======================================================== */

    function byId(
        id
    ) {

        return document.getElementById(
            id
        );
    }


    /* ========================================================
       USER / DEVICE
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

        const inputs = [
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
            i < inputs.length;
            i++
        ) {

            if (
                inputs[i] &&
                inputs[i].value
            ) {

                return cleanUserId(
                    inputs[i].value
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
            localStorage.getItem(
                'gptFileDeviceRole'
            ) ||
            defaultRole()
        );
    }


    /* ========================================================
       GITHUB SETTINGS
    ======================================================== */

    function getGithubSettings() {

        if (
            typeof window.getSettings ===
            'function'
        ) {

            const settings =
                window.getSettings();


            return {

                owner:
                    settings.owner,

                repo:
                    settings.repo,

                branch:
                    settings.branch ||
                    'main',

                token:
                    settings.token,

                userId:
                    getUserId(),

                role:
                    getRole()
            };
        }


        const ownerInput =
            byId(
                'owner'
            );


        const repoInput =
            byId(
                'repo'
            );


        const branchInput =
            byId(
                'branch'
            );


        const tokenInput =
            byId(
                'token'
            );


        return {

            owner:
                ownerInput
                    ? ownerInput.value.trim()
                    : '',

            repo:
                repoInput
                    ? repoInput.value.trim()
                    : '',

            branch:
                branchInput &&
                branchInput.value
                    ? branchInput.value.trim()
                    : 'main',

            token:
                tokenInput
                    ? tokenInput.value.trim()
                    : '',

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
                'GitHub Owner가 없습니다.'
            );
        }


        if (!settings.repo) {

            throw new Error(
                'GitHub Repository가 없습니다.'
            );
        }


        if (!settings.token) {

            throw new Error(
                'GitHub Token이 없습니다.'
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


    /* ========================================================
       STATUS
    ======================================================== */

    function setStatus(
        text,
        type
    ) {

        const target =
            byId(
                'clipboardImageStatus'
            );


        if (!target) {

            return;
        }


        target.className =
            'clipboard-image-status' +
            (
                type
                    ? ' ' + type
                    : ''
            );


        target.textContent =
            text || '';
    }


    /* ========================================================
       FORMAT
    ======================================================== */

    function formatBytes(
        bytes
    ) {

        const value =
            Number(
                bytes || 0
            );


        if (value < 1024) {

            return (
                value +
                ' B'
            );
        }


        if (
            value <
            1024 * 1024
        ) {

            return (
                (
                    value /
                    1024
                ).toFixed(
                    1
                ) +
                ' KB'
            );
        }


        return (
            (
                value /
                1024 /
                1024
            ).toFixed(
                2
            ) +
            ' MB'
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


    function createRemoteFilename() {

        const now =
            new Date();


        const stamp =
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
            );


        const random =
            Math.random()
                .toString(
                    36
                )
                .slice(
                    2,
                    7
                );


        return (
            stamp +
            '__clipboard-' +
            random +
            '.png'
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
            let i = 0;
            i < bytes.length;
            i += chunkSize
        ) {

            const chunk =
                bytes.subarray(
                    i,
                    Math.min(
                        i + chunkSize,
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
       IMAGE CONVERSION
    ======================================================== */

    async function blobToPng(
        sourceBlob
    ) {

        if (
            sourceBlob.type ===
            'image/png'
        ) {

            return sourceBlob;
        }


        const bitmap =
            await createImageBitmap(
                sourceBlob
            );


        const canvas =
            document.createElement(
                'canvas'
            );


        canvas.width =
            bitmap.width;


        canvas.height =
            bitmap.height;


        const context =
            canvas.getContext(
                '2d'
            );


        context.drawImage(
            bitmap,
            0,
            0
        );


        bitmap.close();


        return await new Promise(
            function (
                resolve,
                reject
            ) {

                canvas.toBlob(
                    function (
                        blob
                    ) {

                        if (!blob) {

                            reject(
                                new Error(
                                    'PNG 변환에 실패했습니다.'
                                )
                            );

                            return;
                        }


                        resolve(
                            blob
                        );

                    },
                    'image/png'
                );
            }
        );
    }


    /* ========================================================
       CLIPBOARD READ
    ======================================================== */

    async function readClipboardImage() {

        if (
            !navigator.clipboard ||
            typeof navigator.clipboard.read !==
            'function'
        ) {

            throw new Error(
                '이 브라우저는 이미지 클립보드 읽기를 지원하지 않습니다.'
            );
        }


        if (
            !window.isSecureContext
        ) {

            throw new Error(
                '클립보드 이미지는 HTTPS 환경에서만 읽을 수 있습니다.'
            );
        }


        const items =
            await navigator.clipboard.read();


        if (
            !items ||
            items.length ===
            0
        ) {

            throw new Error(
                '클립보드가 비어 있습니다.'
            );
        }


        let imageBlob =
            null;


        for (
            let i = 0;
            i < items.length;
            i++
        ) {

            const item =
                items[i];


            const imageType =
                item.types.find(
                    function (
                        type
                    ) {

                        return type.startsWith(
                            'image/'
                        );
                    }
                );


            if (imageType) {

                imageBlob =
                    await item.getType(
                        imageType
                    );


                break;
            }
        }


        if (!imageBlob) {

            throw new Error(
                '클립보드에 이미지가 없습니다.\nWin + Shift + S로 캡처한 뒤 다시 눌러주세요.'
            );
        }


        const pngBlob =
            await blobToPng(
                imageBlob
            );


        if (
            pngBlob.size >
            MAX_IMAGE_SIZE
        ) {

            throw new Error(
                '클립보드 이미지가 너무 큽니다.\n\n현재: ' +
                formatBytes(
                    pngBlob.size
                ) +
                '\n최대: ' +
                formatBytes(
                    MAX_IMAGE_SIZE
                )
            );
        }


        return pngBlob;
    }


    /* ========================================================
       PREVIEW
    ======================================================== */

    function revokePreview() {

        if (currentObjectUrl) {

            URL.revokeObjectURL(
                currentObjectUrl
            );


            currentObjectUrl =
                null;
        }
    }


    async function showPreview(
        blob
    ) {

        revokePreview();


        currentBlob =
            blob;


        currentMime =
            blob.type ||
            'image/png';


        currentObjectUrl =
            URL.createObjectURL(
                blob
            );


        const previewWrap =
            byId(
                'clipboardImagePreviewWrap'
            );


        const image =
            byId(
                'clipboardImagePreview'
            );


        const empty =
            byId(
                'clipboardImageEmpty'
            );


        const meta =
            byId(
                'clipboardImageMeta'
            );


        const sendButton =
            byId(
                'clipboardImageSend'
            );


        image.src =
            currentObjectUrl;


        image.hidden =
            false;


        empty.hidden =
            true;


        previewWrap.classList.remove(
            'is-empty'
        );


        await new Promise(
            function (
                resolve
            ) {

                if (
                    image.complete &&
                    image.naturalWidth
                ) {

                    resolve();

                    return;
                }


                image.onload =
                    resolve;


                image.onerror =
                    resolve;
            }
        );


        currentWidth =
            image.naturalWidth ||
            0;


        currentHeight =
            image.naturalHeight ||
            0;


        meta.textContent =
            (
                currentWidth &&
                currentHeight
                    ? currentWidth +
                      ' × ' +
                      currentHeight +
                      ' · '
                    : ''
            ) +
            'PNG · ' +
            formatBytes(
                blob.size
            );


        sendButton.disabled =
            false;
    }


    async function readAndPreview() {

        try {

            setStatus(
                '클립보드 이미지 읽는 중...',
                'busy'
            );


            const blob =
                await readClipboardImage();


            await showPreview(
                blob
            );


            setStatus(
                '✅ 클립보드 이미지 준비 완료',
                'success'
            );

        } catch (error) {

            setStatus(
                '❌ ' +
                error.message,
                'error'
            );
        }
    }


    /* ========================================================
       GITHUB UPLOAD
    ======================================================== */

    async function uploadBlob(
        blob
    ) {

        const settings =
            getGithubSettings();


        validateSettings(
            settings
        );


        const filename =
            createRemoteFilename();


        const path =
            outgoingDirectory(
                settings
            ) +
            '/' +
            filename;


        setStatus(
            '이미지 메모리 변환 중...\n' +
            formatBytes(
                blob.size
            ),
            'busy'
        );


        const buffer =
            await blob.arrayBuffer();


        const base64 =
            arrayBufferToBase64(
                buffer
            );


        setStatus(
            'GitHub로 이미지 전송 중...\n' +
            filename,
            'busy'
        );


        const body = {

            message:
                'Clipboard image transfer ' +
                settings.userId,

            content:
                base64,

            branch:
                settings.branch
        };


        const response =
            await fetch(
                apiUrl(
                    settings,
                    path
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

                const errorData =
                    await response.json();


                if (
                    errorData &&
                    errorData.message
                ) {

                    detail =
                        errorData.message;
                }

            } catch {
            }


            throw new Error(
                'GitHub 업로드 실패: ' +
                detail
            );
        }


        return {

            filename:
                filename,

            path:
                path,

            size:
                blob.size
        };
    }


    async function sendCurrentImage() {

        if (!currentBlob) {

            setStatus(
                '먼저 클립보드 이미지를 읽어주세요.',
                'error'
            );

            return;
        }


        const readButton =
            byId(
                'clipboardImageRead'
            );


        const sendButton =
            byId(
                'clipboardImageSend'
            );


        const sendNowButton =
            byId(
                'clipboardImageSendNow'
            );


        try {

            readButton.disabled =
                true;


            sendButton.disabled =
                true;


            sendNowButton.disabled =
                true;


            const result =
                await uploadBlob(
                    currentBlob
                );


            setStatus(
                '✅ 이미지 전송 완료\n' +
                result.filename +
                '\n' +
                formatBytes(
                    result.size
                ) +
                '\n\n상대방의 받은 파일 목록에서 확인할 수 있습니다.',
                'success'
            );


            refreshExistingFileList();

        } catch (error) {

            setStatus(
                '❌ ' +
                error.message,
                'error'
            );

        } finally {

            readButton.disabled =
                false;


            sendButton.disabled =
                false;


            sendNowButton.disabled =
                false;
        }
    }


    async function readAndSendImmediately() {

        const readButton =
            byId(
                'clipboardImageRead'
            );


        const sendButton =
            byId(
                'clipboardImageSend'
            );


        const sendNowButton =
            byId(
                'clipboardImageSendNow'
            );


        try {

            readButton.disabled =
                true;


            sendButton.disabled =
                true;


            sendNowButton.disabled =
                true;


            setStatus(
                '클립보드 이미지 읽는 중...',
                'busy'
            );


            const blob =
                await readClipboardImage();


            await showPreview(
                blob
            );


            const result =
                await uploadBlob(
                    blob
                );


            setStatus(
                '✅ 클립보드 이미지 바로 전송 완료\n' +
                (
                    currentWidth &&
                    currentHeight
                        ? currentWidth +
                          ' × ' +
                          currentHeight +
                          '\n'
                        : ''
                ) +
                formatBytes(
                    result.size
                ) +
                '\n\nPC 디스크에는 별도 이미지 파일을 생성하지 않았습니다.',
                'success'
            );


            refreshExistingFileList();

        } catch (error) {

            setStatus(
                '❌ ' +
                error.message,
                'error'
            );

        } finally {

            readButton.disabled =
                false;


            sendButton.disabled =
                currentBlob
                    ? false
                    : true;


            sendNowButton.disabled =
                false;
        }
    }


    /* ========================================================
       EXISTING FILE TRANSFER REFRESH
    ======================================================== */

    function refreshExistingFileList() {

        const buttons = [
            byId(
                'gptFileRefresh'
            ),
            byId(
                'fileRefresh'
            )
        ];


        for (
            let i = 0;
            i < buttons.length;
            i++
        ) {

            if (buttons[i]) {

                window.setTimeout(
                    function () {

                        buttons[i].click();

                    },
                    450
                );


                break;
            }
        }
    }


    /* ========================================================
       UI
    ======================================================== */

    function createPanel() {

        if (
            byId(
                'clipboardImagePanel'
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
            'clipboardImagePanel';


        panel.className =
            'clipboard-image-panel';


        panel.innerHTML =
            [
                '<div class="clipboard-image-header">',

                '  <div class="clipboard-image-title">',
                '    🖼 클립보드 이미지',
                '  </div>',

                '  <div class="clipboard-image-badge">',
                '    NO TEMP FILE',
                '  </div>',

                '</div>',

                '<div class="clipboard-image-description">',
                '  Win + Shift + S로 캡처한 이미지를 디스크에 저장하지 않고 클립보드 메모리에서 바로 전송합니다.',
                '</div>',

                '<div',
                '  id="clipboardImagePreviewWrap"',
                '  class="clipboard-image-preview-wrap is-empty"',
                '>',

                '  <div',
                '    id="clipboardImageEmpty"',
                '    class="clipboard-image-empty"',
                '  >',
                '    Win + Shift + S로 화면을 캡처하세요.',
                '  </div>',

                '  <img',
                '    id="clipboardImagePreview"',
                '    class="clipboard-image-preview"',
                '    alt="Clipboard preview"',
                '    hidden',
                '  >',

                '</div>',

                '<div',
                '  id="clipboardImageMeta"',
                '  class="clipboard-image-meta"',
                '></div>',

                '<div class="clipboard-image-actions">',

                '  <button',
                '    id="clipboardImageRead"',
                '    type="button"',
                '  >',
                '    클립보드 이미지 읽기',
                '  </button>',

                '  <button',
                '    id="clipboardImageSend"',
                '    type="button"',
                '    disabled',
                '  >',
                '    현재 이미지 전송',
                '  </button>',

                '</div>',

                '<button',
                '  id="clipboardImageSendNow"',
                '  class="clipboard-image-send-now"',
                '  type="button"',
                '>',
                '  📋 클립보드 이미지 바로 전송',
                '</button>',

                '<div',
                '  id="clipboardImageStatus"',
                '  class="clipboard-image-status"',
                '></div>'
            ].join(
                '\n'
            );


        const firstChild =
            fileMode.firstElementChild;


        if (firstChild) {

            firstChild.insertAdjacentElement(
                'afterend',
                panel
            );

        } else {

            fileMode.appendChild(
                panel
            );
        }


        byId(
            'clipboardImageRead'
        ).addEventListener(
            'click',
            readAndPreview
        );


        byId(
            'clipboardImageSend'
        ).addEventListener(
            'click',
            sendCurrentImage
        );


        byId(
            'clipboardImageSendNow'
        ).addEventListener(
            'click',
            readAndSendImmediately
        );


        return true;
    }


    /* ========================================================
       INIT
    ======================================================== */

    let attempts =
        0;


    const timer =
        window.setInterval(
            function () {

                attempts++;


                if (
                    createPanel() ||
                    attempts >= 150
                ) {

                    window.clearInterval(
                        timer
                    );
                }

            },
            100
        );


    window.addEventListener(
        'beforeunload',
        revokePreview
    );

})();