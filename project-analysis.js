(function () {

    'use strict';


    if (
        window.__GPT_PROJECT_ANALYSIS_V2_LOADED__
    ) {

        return;
    }


    window.__GPT_PROJECT_ANALYSIS_V2_LOADED__ =
        true;


    const POLL_MS =
        5000;


    let pollTimer =
        null;


    let lastStatusSha =
        '';


    const byId =
        function (id) {

            return document.getElementById(
                id
            );
        };


    /* ========================================================
       USER ID
    ======================================================== */

    function getAnalysisUserId() {

        const input =
            byId(
                'bridgeUserId'
            );


        let value =
            input
                ? input.value
                : localStorage.getItem(
                    'bridgeUserId'
                );


        value =
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


        if (!value) {

            value =
                'user1';
        }


        return value;
    }


    /* ========================================================
       SETTINGS
    ======================================================== */

    function getAnalysisSettings() {

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
            getAnalysisUserId();


        return settings;
    }


    /* ========================================================
       UI STATUS
    ======================================================== */

    function setAnalysisStatus(
        text,
        type
    ) {

        const target =
            byId(
                'gptAnalysisStatus'
            );


        if (!target) {
            return;
        }


        target.textContent =
            text;


        target.className =
            'analysis-status';


        if (
            type === 'success'
        ) {

            target.classList.add(
                'analysis-success'
            );
        }


        if (
            type === 'warning'
        ) {

            target.classList.add(
                'analysis-warning'
            );
        }


        if (
            type === 'error'
        ) {

            target.classList.add(
                'analysis-error'
            );
        }
    }


    /* ========================================================
       UTF8 BASE64
    ======================================================== */

    function encodeUtf8Base64(
        text
    ) {

        const bytes =
            new TextEncoder()
                .encode(
                    text
                );


        let binary =
            '';


        const chunk =
            0x8000;


        for (
            let i = 0;
            i < bytes.length;
            i += chunk
        ) {

            binary +=
                String.fromCharCode.apply(
                    null,
                    bytes.subarray(
                        i,
                        i + chunk
                    )
                );
        }


        return btoa(
            binary
        );
    }


    function decodeUtf8Base64(
        value
    ) {

        const binary =
            atob(
                String(
                    value || ''
                ).replace(
                    /\s/g,
                    ''
                )
            );


        const bytes =
            new Uint8Array(
                binary.length
            );


        for (
            let i = 0;
            i < binary.length;
            i++
        ) {

            bytes[i] =
                binary.charCodeAt(
                    i
                );
        }


        return new TextDecoder(
            'utf-8'
        ).decode(
            bytes
        );
    }


    /* ========================================================
       GITHUB READ
    ======================================================== */

    function githubHeaders(
        token
    ) {

        return {

            Accept:
                'application/vnd.github+json',

            Authorization:
                'Bearer ' + token,

            'X-GitHub-Api-Version':
                '2022-11-28'
        };
    }


    function githubFileUrl(
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


    async function readGithubFile(
        settings,
        path
    ) {

        const response =
            await fetch(
                githubFileUrl(
                    settings,
                    path
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

            return null;
        }


        if (!response.ok) {

            throw new Error(
                'GitHub 조회 실패: ' +
                response.status
            );
        }


        return await response.json();
    }


    /* ========================================================
       POWERSHELL SCRIPT GENERATOR
    ======================================================== */

    function makeAnalysisPowerShell(
        projectPath,
        includePattern,
        useCompress
    ) {

        const project64 =
            encodeUtf8Base64(
                projectPath
            );


        const include64 =
            encodeUtf8Base64(
                includePattern || ''
            );


        const compressValue =
            useCompress
                ? '$true'
                : '$false';


        const lines =
            [];


        lines.push(
            '$ErrorActionPreference = "Stop"'
        );

        lines.push(
            ''
        );

        lines.push(
            '$Root = "C:\\dev\\gpt-to-pc-auto-runner"'
        );

        lines.push(
            '$ConfigPath = Join-Path $Root "config.json"'
        );

        lines.push(
            '$TokenPath = Join-Path $Root "token.txt"'
        );

        lines.push(
            '$AnalysisDir = Join-Path $Root "Analysis"'
        );

        lines.push(
            '$Utf8 = New-Object System.Text.UTF8Encoding($false)'
        );

        lines.push(
            ''
        );

        lines.push(
            'New-Item -ItemType Directory -Path $AnalysisDir -Force | Out-Null'
        );

        lines.push(
            ''
        );

        lines.push(
            '$ProjectPath = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("' +
            project64 +
            '"))'
        );

        lines.push(
            '$IncludePattern = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("' +
            include64 +
            '"))'
        );

        lines.push(
            '$UseCompress = ' +
            compressValue
        );

        lines.push(
            ''
        );

        lines.push(
            'if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {'
        );

        lines.push(
            '    throw ("프로젝트 경로가 없습니다: " + $ProjectPath)'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            '$Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json'
        );

        lines.push(
            ''
        );

        lines.push(
            'if ([string]::IsNullOrWhiteSpace([string]$Config.UserId)) {'
        );

        lines.push(
            '    throw "config.json UserId가 없습니다."'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            '$Encrypted = Get-Content -LiteralPath $TokenPath -Raw'
        );

        lines.push(
            '$Secure = $Encrypted | ConvertTo-SecureString'
        );

        lines.push(
            '$Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)'
        );

        lines.push(
            ''
        );

        lines.push(
            'try {'
        );

        lines.push(
            '    $GitHubToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)'
        );

        lines.push(
            '}'
        );

        lines.push(
            'finally {'
        );

        lines.push(
            '    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            'function Get-Headers {'
        );

        lines.push(
            '    return @{'
        );

        lines.push(
            '        Accept = "application/vnd.github+json"'
        );

        lines.push(
            '        Authorization = "Bearer " + $GitHubToken'
        );

        lines.push(
            '        "X-GitHub-Api-Version" = "2022-11-28"'
        );

        lines.push(
            '    }'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            'function Get-ApiUrl {'
        );

        lines.push(
            '    param([string]$Path)'
        );

        lines.push(
            ''
        );

        lines.push(
            '    $Parts = $Path -split "/"'
        );

        lines.push(
            '    $EncodedParts = @()'
        );

        lines.push(
            ''
        );

        lines.push(
            '    foreach ($Part in $Parts) {'
        );

        lines.push(
            '        $EncodedParts += [Uri]::EscapeDataString([string]$Part)'
        );

        lines.push(
            '    }'
        );

        lines.push(
            ''
        );

        lines.push(
            '    return ('
        );

        lines.push(
            '        "https://api.github.com/repos/" +'
        );

        lines.push(
            '        $Config.Owner + "/" +'
        );

        lines.push(
            '        $Config.Repo +'
        );

        lines.push(
            '        "/contents/" +'
        );

        lines.push(
            '        ($EncodedParts -join "/")'
        );

        lines.push(
            '    )'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            'function Get-RemoteFile {'
        );

        lines.push(
            '    param([string]$Path)'
        );

        lines.push(
            ''
        );

        lines.push(
            '    $Url = Get-ApiUrl -Path $Path'
        );

        lines.push(
            '    $Branch = [Uri]::EscapeDataString([string]$Config.Branch)'
        );

        lines.push(
            ''
        );

        lines.push(
            '    return (Invoke-RestMethod -Uri ($Url + "?ref=" + $Branch) -Headers (Get-Headers) -Method Get -TimeoutSec 30)'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            'function Put-RemoteText {'
        );

        lines.push(
            '    param([string]$Path,[string]$Text,[string]$Message)'
        );

        lines.push(
            ''
        );

        lines.push(
            '    for ($Attempt = 1; $Attempt -le 5; $Attempt++) {'
        );

        lines.push(
            ''
        );

        lines.push(
            '        try {'
        );

        lines.push(
            ''
        );

        lines.push(
            '            $Sha = $null'
        );

        lines.push(
            ''
        );

        lines.push(
            '            try {'
        );

        lines.push(
            '                $Existing = Get-RemoteFile -Path $Path'
        );

        lines.push(
            '                $Sha = [string]$Existing.sha'
        );

        lines.push(
            '            }'
        );

        lines.push(
            '            catch {'
        );

        lines.push(
            ''
        );

        lines.push(
            '                $StatusCode = 0'
        );

        lines.push(
            ''
        );

        lines.push(
            '                try {'
        );

        lines.push(
            '                    $StatusCode = [int]$_.Exception.Response.StatusCode'
        );

        lines.push(
            '                }'
        );

        lines.push(
            '                catch {'
        );

        lines.push(
            '                }'
        );

        lines.push(
            ''
        );

        lines.push(
            '                if ($StatusCode -ne 404) {'
        );

        lines.push(
            '                    throw'
        );

        lines.push(
            '                }'
        );

        lines.push(
            '            }'
        );

        lines.push(
            ''
        );

        lines.push(
            '            $Base64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$Text))'
        );

        lines.push(
            ''
        );

        lines.push(
            '            $Body = [ordered]@{'
        );

        lines.push(
            '                message = $Message'
        );

        lines.push(
            '                content = $Base64'
        );

        lines.push(
            '                branch = [string]$Config.Branch'
        );

        lines.push(
            '            }'
        );

        lines.push(
            ''
        );

        lines.push(
            '            if ($Sha) {'
        );

        lines.push(
            '                $Body.sha = $Sha'
        );

        lines.push(
            '            }'
        );

        lines.push(
            ''
        );

        lines.push(
            '            Invoke-RestMethod -Uri (Get-ApiUrl -Path $Path) -Headers (Get-Headers) -Method Put -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10) -TimeoutSec 60 | Out-Null'
        );

        lines.push(
            ''
        );

        lines.push(
            '            return'
        );

        lines.push(
            '        }'
        );

        lines.push(
            '        catch {'
        );

        lines.push(
            ''
        );

        lines.push(
            '            if ($Attempt -ge 5) {'
        );

        lines.push(
            '                throw'
        );

        lines.push(
            '            }'
        );

        lines.push(
            ''
        );

        lines.push(
            '            Start-Sleep -Milliseconds (500 * $Attempt)'
        );

        lines.push(
            '        }'
        );

        lines.push(
            '    }'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            '$ResultBase = "users/" + $Config.UserId + "/analysis/"'
        );

        lines.push(
            '$StatusRemote = $ResultBase + "status.json"'
        );

        lines.push(
            '$ResultRemote = $ResultBase + "latest.json"'
        );

        lines.push(
            ''
        );

        lines.push(
            '$StartedAt = Get-Date'
        );

        lines.push(
            ''
        );

        lines.push(
            '$Running = [ordered]@{'
        );

        lines.push(
            '    status = "running"'
        );

        lines.push(
            '    projectPath = $ProjectPath'
        );

        lines.push(
            '    include = $IncludePattern'
        );

        lines.push(
            '    compress = $UseCompress'
        );

        lines.push(
            '    startedAt = $StartedAt.ToString("o")'
        );

        lines.push(
            '} | ConvertTo-Json -Depth 10'
        );

        lines.push(
            ''
        );

        lines.push(
            'Put-RemoteText -Path $StatusRemote -Text $Running -Message ("Repomix running " + $Config.UserId)'
        );

        lines.push(
            ''
        );

        lines.push(
            '$OutputPath = Join-Path $AnalysisDir "repomix-output.json"'
        );

        lines.push(
            ''
        );

        lines.push(
            'Remove-Item -LiteralPath $OutputPath -Force -ErrorAction SilentlyContinue'
        );

        lines.push(
            ''
        );

        lines.push(
            '$Npx = Get-Command "npx.cmd" -ErrorAction SilentlyContinue'
        );

        lines.push(
            ''
        );

        lines.push(
            'if ($null -eq $Npx) {'
        );

        lines.push(
            '    $Npx = Get-Command "npx" -ErrorAction SilentlyContinue'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            'if ($null -eq $Npx) {'
        );

        lines.push(
            '    throw "npx를 찾을 수 없습니다. Node.js/npm 설치를 확인하세요."'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            '$RepomixArgs = @('
        );

        lines.push(
            '    "repomix@latest"'
        );

        lines.push(
            '    "--style"'
        );

        lines.push(
            '    "json"'
        );

        lines.push(
            '    "--output"'
        );

        lines.push(
            '    $OutputPath'
        );

        lines.push(
            '    "--quiet"'
        );

        lines.push(
            ')'
        );

        lines.push(
            ''
        );

        lines.push(
            'if (-not [string]::IsNullOrWhiteSpace($IncludePattern)) {'
        );

        lines.push(
            '    $RepomixArgs += "--include"'
        );

        lines.push(
            '    $RepomixArgs += $IncludePattern'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            'if ($UseCompress) {'
        );

        lines.push(
            '    $RepomixArgs += "--compress"'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            'Push-Location $ProjectPath'
        );

        lines.push(
            ''
        );

        lines.push(
            'try {'
        );

        lines.push(
            ''
        );

        lines.push(
            '    & $Npx.Source @RepomixArgs'
        );

        lines.push(
            ''
        );

        lines.push(
            '    if ($LASTEXITCODE -ne 0) {'
        );

        lines.push(
            '        throw ("Repomix 실행 실패. ExitCode=" + $LASTEXITCODE)'
        );

        lines.push(
            '    }'
        );

        lines.push(
            '}'
        );

        lines.push(
            'finally {'
        );

        lines.push(
            '    Pop-Location'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            'if (-not (Test-Path -LiteralPath $OutputPath)) {'
        );

        lines.push(
            '    throw "Repomix 결과 파일이 생성되지 않았습니다."'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            '$Info = Get-Item -LiteralPath $OutputPath'
        );

        lines.push(
            '$MaxBytes = 900KB'
        );

        lines.push(
            ''
        );

        lines.push(
            'if ($Info.Length -gt $MaxBytes) {'
        );

        lines.push(
            ''
        );

        lines.push(
            '    $TooLarge = [ordered]@{'
        );

        lines.push(
            '        status = "too_large"'
        );

        lines.push(
            '        projectPath = $ProjectPath'
        );

        lines.push(
            '        bytes = $Info.Length'
        );

        lines.push(
            '        maxBytes = $MaxBytes'
        );

        lines.push(
            '        include = $IncludePattern'
        );

        lines.push(
            '        compress = $UseCompress'
        );

        lines.push(
            '        endedAt = (Get-Date).ToString("o")'
        );

        lines.push(
            '    } | ConvertTo-Json -Depth 10'
        );

        lines.push(
            ''
        );

        lines.push(
            '    Put-RemoteText -Path $StatusRemote -Text $TooLarge -Message ("Repomix too large " + $Config.UserId)'
        );

        lines.push(
            ''
        );

        lines.push(
            '    Write-Host ""'
        );

        lines.push(
            '    Write-Host "REPOMIX_RESULT_TOO_LARGE"'
        );

        lines.push(
            '    Write-Host ("Bytes: " + $Info.Length)'
        );

        lines.push(
            ''
        );

        lines.push(
            '    exit 0'
        );

        lines.push(
            '}'
        );

        lines.push(
            ''
        );

        lines.push(
            '$ResultText = Get-Content -LiteralPath $OutputPath -Raw -Encoding UTF8'
        );

        lines.push(
            ''
        );

        lines.push(
            'Put-RemoteText -Path $ResultRemote -Text $ResultText -Message ("Repomix result " + $Config.UserId)'
        );

        lines.push(
            ''
        );

        lines.push(
            '$Success = [ordered]@{'
        );

        lines.push(
            '    status = "success"'
        );

        lines.push(
            '    projectPath = $ProjectPath'
        );

        lines.push(
            '    bytes = $Info.Length'
        );

        lines.push(
            '    include = $IncludePattern'
        );

        lines.push(
            '    compress = $UseCompress'
        );

        lines.push(
            '    startedAt = $StartedAt.ToString("o")'
        );

        lines.push(
            '    endedAt = (Get-Date).ToString("o")'
        );

        lines.push(
            '} | ConvertTo-Json -Depth 10'
        );

        lines.push(
            ''
        );

        lines.push(
            'Put-RemoteText -Path $StatusRemote -Text $Success -Message ("Repomix success " + $Config.UserId)'
        );

        lines.push(
            ''
        );

        lines.push(
            'Write-Host ""'
        );

        lines.push(
            'Write-Host "============================================"'
        );

        lines.push(
            'Write-Host " REPOMIX PROJECT ANALYSIS SUCCESS"'
        );

        lines.push(
            'Write-Host "============================================"'
        );

        lines.push(
            'Write-Host ""'
        );

        lines.push(
            'Write-Host ("Project: " + $ProjectPath)'
        );

        lines.push(
            'Write-Host ("Bytes  : " + $Info.Length)'
        );

        lines.push(
            'Write-Host ("Remote : " + $ResultRemote)'
        );

        lines.push(
            ''
        );


        return lines.join(
            '\r\n'
        );
    }


    /* ========================================================
       START
    ======================================================== */

    async function startAnalysis() {

        try {

            const projectPath =
                byId(
                    'gptAnalysisProjectPath'
                )
                    .value
                    .trim();


            const includePattern =
                byId(
                    'gptAnalysisInclude'
                )
                    .value
                    .trim();


            const useCompress =
                byId(
                    'gptAnalysisCompress'
                ).checked;


            if (!projectPath) {

                throw new Error(
                    '프로젝트 경로를 입력하세요.'
                );
            }


            localStorage.setItem(
                'analysisProjectPath',
                projectPath
            );


            localStorage.setItem(
                'analysisInclude',
                includePattern
            );


            localStorage.setItem(
                'analysisCompress',
                useCompress
                    ? '1'
                    : '0'
            );


            const script =
                makeAnalysisPowerShell(
                    projectPath,
                    includePattern,
                    useCompress
                );


            setAnalysisStatus(
                '분석 요청을 PC로 전송 중...\n\n' +
                projectPath
            );


            if (
                typeof window.sendToGitHub !==
                'function'
            ) {

                throw new Error(
                    '기존 GPT -> PC 전송 함수를 찾지 못했습니다.'
                );
            }


            await window.sendToGitHub(
                script
            );


            setAnalysisStatus(
                '✅ 분석 요청 전송 완료\n\n' +
                'PC에서 Repomix 실행을 기다리는 중...',
                'success'
            );


            startPolling();

        } catch (error) {

            setAnalysisStatus(
                '❌ 분석 요청 실패\n\n' +
                error.message,
                'error'
            );
        }
    }


    /* ========================================================
       STATUS / RESULT
    ======================================================== */

    async function refreshAnalysisStatus(
        manual
    ) {

        try {

            const settings =
                getAnalysisSettings();


            const base =
                'users/' +
                settings.userId +
                '/analysis/';


            const statusFile =
                await readGithubFile(
                    settings,
                    base +
                    'status.json'
                );


            if (!statusFile) {

                if (manual) {

                    setAnalysisStatus(
                        '아직 프로젝트 분석 기록이 없습니다.'
                    );
                }


                return;
            }


            if (
                !manual &&
                statusFile.sha ===
                lastStatusSha
            ) {

                return;
            }


            lastStatusSha =
                statusFile.sha;


            const statusText =
                decodeUtf8Base64(
                    statusFile.content
                );


            const state =
                JSON.parse(
                    statusText
                );


            if (
                state.status ===
                'running'
            ) {

                let message =
                    '⏳ Repomix 분석 중\n\n' +
                    state.projectPath;


                if (
                    state.include
                ) {

                    message +=
                        '\n\nInclude: ' +
                        state.include;
                }


                if (
                    state.compress
                ) {

                    message +=
                        '\nCompress: 사용';
                }


                setAnalysisStatus(
                    message
                );


                return;
            }


            if (
                state.status ===
                'too_large'
            ) {

                setAnalysisStatus(
                    '⚠️ Repomix 결과가 너무 큽니다.\n\n' +
                    '크기: ' +
                    Math.round(
                        state.bytes /
                        1024
                    ).toLocaleString() +
                    ' KB\n\n' +
                    'Include 패턴으로 분석 범위를 줄이거나\n' +
                    'Compress를 사용해주세요.',
                    'warning'
                );


                return;
            }


            if (
                state.status ===
                'success'
            ) {

                setAnalysisStatus(
                    '✅ Repomix 분석 완료\n\n' +
                    state.projectPath +
                    '\n\n크기: ' +
                    Math.round(
                        state.bytes /
                        1024
                    ).toLocaleString() +
                    ' KB',
                    'success'
                );


                await loadAnalysisResult(
                    settings,
                    base
                );
            }

        } catch (error) {

            if (manual) {

                setAnalysisStatus(
                    '❌ 분석 상태 확인 실패\n\n' +
                    error.message,
                    'error'
                );
            }
        }
    }


    async function loadAnalysisResult(
        settings,
        base
    ) {

        const resultFile =
            await readGithubFile(
                settings,
                base +
                'latest.json'
            );


        if (!resultFile) {

            throw new Error(
                'Repomix 결과 latest.json을 찾지 못했습니다.'
            );
        }


        const text =
            decodeUtf8Base64(
                resultFile.content
            );


        const resultBox =
            byId(
                'gptAnalysisResult'
            );


        resultBox.value =
            text;


        byId(
            'gptAnalysisMeta'
        ).textContent =
            text.length
                .toLocaleString() +
            '자';


        byId(
            'gptAnalysisAccordion'
        ).classList.add(
            'open'
        );
    }


    function startPolling() {

        if (pollTimer) {

            clearInterval(
                pollTimer
            );
        }


        refreshAnalysisStatus(
            true
        );


        pollTimer =
            setInterval(
                function () {

                    const mode =
                        byId(
                            'gptAnalysisMode'
                        );


                    if (
                        mode &&
                        mode.classList.contains(
                            'analysis-visible'
                        )
                    ) {

                        refreshAnalysisStatus(
                            false
                        );
                    }

                },
                POLL_MS
            );
    }


    /* ========================================================
       COPY
    ======================================================== */

    /* ========================================================
       DOWNLOAD JSON
    ======================================================== */

    function makeSafeFilenamePart(
        value
    ) {

        let text =
            String(
                value || ''
            )
                .trim();


        if (!text) {

            return 'project';
        }


        text =
            text
                .replace(
                    /\\/g,
                    '/'
                );


        const parts =
            text
                .split('/')
                .filter(
                    Boolean
                );


        let name =
            parts.length
                ? parts[
                    parts.length - 1
                ]
                : 'project';


        name =
            name
                .toLowerCase()
                .replace(
                    /[^a-z0-9가-힣._-]/g,
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
            name ||
            'project'
        );
    }


    function downloadTimestamp() {

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
            )
        );
    }


    function downloadAnalysisJson() {

        try {

            const resultBox =
                byId(
                    'gptAnalysisResult'
                );


            if (!resultBox) {

                throw new Error(
                    'Repomix 결과 영역을 찾지 못했습니다.'
                );
            }


            const text =
                resultBox.value;


            if (!text) {

                throw new Error(
                    '다운로드할 Repomix 결과가 없습니다.'
                );
            }


            // JSON 결과인지 한번 검증
            try {

                JSON.parse(
                    text
                );

            } catch (error) {

                throw new Error(
                    '현재 분석 결과가 올바른 JSON 형식이 아닙니다.'
                );
            }


            const projectPathInput =
                byId(
                    'gptAnalysisProjectPath'
                );


            const projectName =
                makeSafeFilenamePart(
                    projectPathInput
                        ? projectPathInput.value
                        : ''
                );


            const filename =
                'repomix-' +
                projectName +
                '-' +
                downloadTimestamp() +
                '.json';


            const blob =
                new Blob(
                    [
                        text
                    ],
                    {
                        type:
                            'application/json;charset=utf-8'
                    }
                );


            const url =
                URL.createObjectURL(
                    blob
                );


            const link =
                document.createElement(
                    'a'
                );


            link.href =
                url;


            link.download =
                filename;


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
                        url
                    );

                },
                1000
            );


            setAnalysisStatus(
                '✅ JSON 파일 다운로드 시작\n\n' +
                filename +
                '\n\n' +
                text.length
                    .toLocaleString() +
                '자',
                'success'
            );

        } catch (error) {

            setAnalysisStatus(
                '❌ JSON 다운로드 실패\n\n' +
                error.message,
                'error'
            );
        }
    }

    async function copyJson() {

        const text =
            byId(
                'gptAnalysisResult'
            ).value;


        if (!text) {

            alert(
                '분석 결과가 없습니다.'
            );

            return;
        }


        await navigator
            .clipboard
            .writeText(
                text
            );


        setAnalysisStatus(
            'Repomix JSON을 클립보드에 복사했습니다.',
            'success'
        );
    }


    async function copyForGpt() {

        const text =
            byId(
                'gptAnalysisResult'
            ).value;


        if (!text) {

            alert(
                '분석 결과가 없습니다.'
            );

            return;
        }


        const prompt =
            [
                '아래 내용은 Repomix로 추출한 현재 프로젝트의 실제 코드입니다.',
                '',
                '이 내용을 현재 프로젝트의 실제 상태로 간주해주세요.',
                '',
                '앞으로 수정할 때는 파일 전체를 추측해서 다시 생성하지 말고,',
                'Repomix에 포함된 실제 기존 코드 블록을 기준으로',
                'PowerShell 부분 패치를 작성해주세요.',
                '',
                '패치에는 가능하면 다음을 포함해주세요.',
                '- 수정 전 파일 백업',
                '- 대상 파일 및 기존 코드 검증',
                '- 정확한 부분 코드 교체',
                '- 수정 후 빌드/문법 검사',
                '- 실패 시 자동 복구',
                '',
                '===== REPOMIX START =====',
                '',
                text,
                '',
                '===== REPOMIX END ====='
            ].join(
                '\n'
            );


        await navigator
            .clipboard
            .writeText(
                prompt
            );


        setAnalysisStatus(
            'GPT 분석용 Repomix 내용을 클립보드에 복사했습니다.',
            'success'
        );
    }


    /* ========================================================
       MODE
    ======================================================== */

    function hideAnalysisMode() {

        const analysis =
            byId(
                'gptAnalysisMode'
            );


        if (analysis) {

            analysis.classList.remove(
                'analysis-visible'
            );
        }


        const button =
            byId(
                'gptAnalysisModeButton'
            );


        if (button) {

            button.className =
                'inactive';
        }
    }


    function showAnalysisMode() {

        const sendMode =
            byId(
                'sendMode'
            );


        const receiveMode =
            byId(
                'receiveMode'
            );


        const textMode =
            byId(
                'gptTextMode'
            );


        const analysisMode =
            byId(
                'gptAnalysisMode'
            );


        if (sendMode) {

            sendMode.classList.add(
                'hidden'
            );
        }


        if (receiveMode) {

            receiveMode.classList.add(
                'hidden'
            );
        }


        if (textMode) {

            textMode.classList.remove(
                'gpt-text-visible'
            );
        }


        analysisMode.classList.add(
            'analysis-visible'
        );


        document
            .querySelectorAll(
                '.modebar button'
            )
            .forEach(
                function (button) {

                    button.className =
                        button.id ===
                        'gptAnalysisModeButton'
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
                'PC 프로젝트를 Repomix로 분석해 GPT에 전달합니다.';
        }


        const url =
            new URL(
                location.href
            );


        url.searchParams.set(
            'mode',
            'analysis'
        );


        history.replaceState(
            {},
            '',
            url
        );


        updatePathPreview();

        startPolling();
    }


    /* ========================================================
       PATH PREVIEW
    ======================================================== */

    function updatePathPreview() {

        const target =
            byId(
                'gptAnalysisPathPreview'
            );


        if (!target) {
            return;
        }


        const id =
            getAnalysisUserId();


        target.textContent =
            '결과 저장 경로\n' +
            'users/' +
            id +
            '/analysis/latest.json';
    }


    /* ========================================================
       CREATE UI
    ======================================================== */

    function createAnalysisUi() {

        const modebar =
            document.querySelector(
                '.modebar'
            );


        if (!modebar) {

            return false;
        }


        if (
            byId(
                'gptAnalysisModeButton'
            ) ||
            byId(
                'gptAnalysisMode'
            )
        ) {

            return true;
        }


        const tab =
            document.createElement(
                'button'
            );


        tab.id =
            'gptAnalysisModeButton';


        tab.type =
            'button';


        tab.className =
            'inactive';


        tab.textContent =
            '프로젝트 분석';


        tab.addEventListener(
            'click',
            showAnalysisMode
        );


        modebar.appendChild(
            tab
        );


        modebar.style.gridTemplateColumns =
            'repeat(4,minmax(0,1fr))';


        const analysis =
            document.createElement(
                'div'
            );


        analysis.id =
            'gptAnalysisMode';


        analysis.innerHTML =
            [
                '<div class="card analysis-card">',

                '  <div class="analysis-title">',
                '    프로젝트 분석',
                '  </div>',

                '  <div class="analysis-description">',
                '    PC 프로젝트를 Repomix JSON으로 분석합니다.<br>',
                '    분석 결과를 GPT에 전달하면 현재 실제 코드를 기준으로 부분 패치를 만들 수 있습니다.',
                '  </div>',

                '  <label>',
                '    PC 프로젝트 경로',
                '  </label>',

                '  <input',
                '    id="gptAnalysisProjectPath"',
                '    type="text"',
                '    placeholder="C:\\dev\\workspace\\cad-drawing-viewer"',
                '  >',

                '  <div class="analysis-hint">',
                '    PC에 실제로 존재하는 프로젝트 루트 경로를 입력합니다.',
                '  </div>',

                '  <label>',
                '    Include 패턴 (선택)',
                '  </label>',

                '  <input',
                '    id="gptAnalysisInclude"',
                '    type="text"',
                '    placeholder="src/pages/GeometryShapeViewerPage.tsx"',
                '  >',

                '  <div class="analysis-hint">',
                '    큰 프로젝트는 수정할 파일이나 폴더만 지정하는 것을 권장합니다.',
                '  </div>',

                '  <label class="analysis-option">',

                '    <input',
                '      id="gptAnalysisCompress"',
                '      type="checkbox"',
                '    >',

                '    <span>',

                '      <div class="analysis-option-title">',
                '        Repomix Compress 사용',
                '      </div>',

                '      <div class="analysis-option-description">',
                '        구조 파악에는 유용하지만 실제 코드 부분 수정용 분석에서는 보통 OFF를 권장합니다.',
                '      </div>',

                '    </span>',

                '  </label>',

                '  <div',
                '    id="gptAnalysisPathPreview"',
                '    class="analysis-path-preview"',
                '  ></div>',

                '  <button',
                '    id="gptAnalysisStart"',
                '    class="green"',
                '    type="button"',
                '  >',
                '    Repomix 분석 시작',
                '  </button>',

                '</div>',


                '<div',
                '  id="gptAnalysisAccordion"',
                '  class="analysis-accordion"',
                '>',

                '  <button',
                '    id="gptAnalysisAccordionHeader"',
                '    class="analysis-accordion-header"',
                '    type="button"',
                '  >',

                '    <span class="analysis-accordion-left">',

                '      <span>',
                '        📦',
                '      </span>',

                '      <span class="analysis-accordion-title">',
                '        Repomix 분석 결과',
                '      </span>',

                '    </span>',

                '    <span class="analysis-accordion-right">',

                '      <span',
                '        id="gptAnalysisMeta"',
                '        class="analysis-meta"',
                '      >',
                '        없음',
                '      </span>',

                '      <span class="analysis-arrow">',
                '        ▼',
                '      </span>',

                '    </span>',

                '  </button>',

                '  <div class="analysis-accordion-body">',

                '    <textarea',
                '      id="gptAnalysisResult"',
                '      readonly',
                '    ></textarea>',

                '    <div class="analysis-result-actions">',

                '      <button',
                '        id="gptAnalysisCopyGpt"',
                '        class="green"',
                '        type="button"',
                '      >',
                '        GPT 분석용으로 복사',
                '      </button>',

                '      <button',
                '        id="gptAnalysisDownloadJson"',
                '        class="blue"',
                '        type="button"',
                '      >',
                '        JSON 파일 다운로드',
                '      </button>',

                '      <button',
                '        id="gptAnalysisCopyJson"',
                '        class="gray"',
                '        type="button"',
                '      >',
                '        JSON만 복사',
                '      </button>',

                '    </div>',

                '  </div>',

                '</div>',


                '<div class="card">',

                '  <div',
                '    id="gptAnalysisStatus"',
                '    class="analysis-status"',
                '  >',
                '    프로젝트 분석 준비됨',
                '  </div>',

                '  <button',
                '    id="gptAnalysisRefresh"',
                '    class="blue"',
                '    type="button"',
                '  >',
                '    분석 상태 새로고침',
                '  </button>',

                '</div>'
            ].join(
                '\n'
            );


        const textMode =
            byId(
                'gptTextMode'
            );


        if (textMode) {

            textMode.insertAdjacentElement(
                'afterend',
                analysis
            );

        } else {

            modebar.insertAdjacentElement(
                'afterend',
                analysis
            );
        }


        byId(
            'gptAnalysisProjectPath'
        ).value =
            localStorage.getItem(
                'analysisProjectPath'
            ) || '';


        byId(
            'gptAnalysisInclude'
        ).value =
            localStorage.getItem(
                'analysisInclude'
            ) || '';


        byId(
            'gptAnalysisCompress'
        ).checked =
            localStorage.getItem(
                'analysisCompress'
            ) === '1';


        byId(
            'gptAnalysisStart'
        ).addEventListener(
            'click',
            startAnalysis
        );


        byId(
            'gptAnalysisRefresh'
        ).addEventListener(
            'click',
            function () {

                refreshAnalysisStatus(
                    true
                );
            }
        );


        byId(
            'gptAnalysisCopyGpt'
        ).addEventListener(
            'click',
            copyForGpt
        );


        byId(
            'gptAnalysisDownloadJson'
        ).addEventListener(
            'click',
            downloadAnalysisJson
        );


        byId(
            'gptAnalysisCopyJson'
        ).addEventListener(
            'click',
            copyJson
        );


        byId(
            'gptAnalysisAccordionHeader'
        ).addEventListener(
            'click',
            function () {

                byId(
                    'gptAnalysisAccordion'
                ).classList.toggle(
                    'open'
                );
            }
        );


        const userInput =
            byId(
                'bridgeUserId'
            );


        if (userInput) {

            userInput.addEventListener(
                'change',
                updatePathPreview
            );


            userInput.addEventListener(
                'input',
                updatePathPreview
            );
        }


        updatePathPreview();


        /* ----------------------------------------------------
           다른 탭 클릭 시 Analysis 숨김
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
                    'gptAnalysisModeButton'
                ) {

                    hideAnalysisMode();
                }

            },
            true
        );


        /* ----------------------------------------------------
           기존 setMode에도 연결
        ---------------------------------------------------- */

        if (
            typeof window.setMode ===
            'function' &&
            !window.__GPT_ANALYSIS_SETMODE_WRAPPED__
        ) {

            window.__GPT_ANALYSIS_SETMODE_WRAPPED__ =
                true;


            const oldSetMode =
                window.setMode;


            window.setMode =
                function (mode) {

                    hideAnalysisMode();


                    return oldSetMode(
                        mode
                    );
                };
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
                    createAnalysisUi() ||
                    attempts >= 100
                ) {

                    clearInterval(
                        initTimer
                    );


                    const requested =
                        new URLSearchParams(
                            location.search
                        ).get(
                            'mode'
                        );


                    if (
                        requested ===
                        'analysis'
                    ) {

                        showAnalysisMode();
                    }
                }

            },
            100
        );

})();