console.log("QueryBot Audio Converter loaded");


function addButton() {

    // 기존 패널 제거
    const oldDock = document.getElementById("flac-dock");

    if (oldDock) {
        oldDock.remove();
    }


    // ========================================================
    // 저장된 접힘 상태 불러오기
    // ========================================================

    let isCollapsed = false;

    try {
        isCollapsed =
            localStorage.getItem("flacDockCollapsed") === "true";
    } catch (e) {
        isCollapsed = false;
    }


    // ========================================================
    // 전체 도크(wrapper)
    // ========================================================

    const dock = document.createElement("div");
    dock.id = "flac-dock";

    dock.style.position = "fixed";
    dock.style.top = "92px";
    dock.style.right = "16px";
    dock.style.zIndex = "2147483647";

    dock.style.display = "flex";
    dock.style.alignItems = "center";

    dock.style.transition = "transform 0.28s ease";
    dock.style.willChange = "transform";


    // ========================================================
    // 접기/펼치기 핸들
    // ========================================================

    const handle = document.createElement("button");
    handle.id = "flac-dock-toggle";
    handle.innerText = isCollapsed ? "◀" : "▶";

    handle.style.width = "34px";
    handle.style.height = "46px";
    handle.style.border = "1px solid rgba(255,255,255,0.14)";
    handle.style.borderRadius = "14px 0 0 14px";
    handle.style.background =
        "linear-gradient(135deg, rgba(40,43,50,0.96), rgba(55,59,70,0.96))";
    handle.style.color = "#ffffff";
    handle.style.fontSize = "14px";
    handle.style.fontWeight = "700";
    handle.style.cursor = "pointer";
    handle.style.boxShadow =
        "0 8px 24px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.10)";
    handle.style.backdropFilter = "blur(12px)";
    handle.style.display = "flex";
    handle.style.alignItems = "center";
    handle.style.justifyContent = "center";
    handle.style.padding = "0";
    handle.style.margin = "0";
    handle.style.transition = "all 0.18s ease";


    // ========================================================
    // 본체 패널
    // ========================================================

    const button = document.createElement("button");
    button.id = "flac-extract-button";

    button.innerHTML = `
        <span class="flac-icon">♪</span>
        <span class="flac-text">FLAC 추출</span>
    `;

    button.style.height = "46px";
    button.style.padding = "0 18px";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.gap = "9px";

    button.style.border = "1px solid rgba(255,255,255,0.16)";
    button.style.borderLeft = "none";
    button.style.borderRadius = "0 15px 15px 0";

    button.style.background =
        "linear-gradient(135deg, rgba(30,32,38,0.97), rgba(52,55,65,0.97))";

    button.style.color = "#ffffff";

    button.style.fontFamily =
        '"Segoe UI", "Malgun Gothic", Arial, sans-serif';

    button.style.fontSize = "14px";
    button.style.fontWeight = "600";
    button.style.letterSpacing = "-0.2px";

    button.style.cursor = "pointer";

    button.style.boxShadow =
        "0 8px 24px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.10)";

    button.style.backdropFilter = "blur(12px)";

    button.style.transition =
        "transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease";

    button.style.userSelect = "none";
    button.style.whiteSpace = "nowrap";


    // ========================================================
    // 아이콘 스타일
    // ========================================================

    const icon = button.querySelector(".flac-icon");

    icon.style.width = "27px";
    icon.style.height = "27px";
    icon.style.display = "flex";
    icon.style.alignItems = "center";
    icon.style.justifyContent = "center";
    icon.style.borderRadius = "9px";
    icon.style.background =
        "linear-gradient(135deg, rgba(255,255,255,0.20), rgba(255,255,255,0.08))";
    icon.style.fontSize = "15px";
    icon.style.fontWeight = "700";


    // ========================================================
    // 펼침 / 접힘 상태 반영
    // ========================================================

    function applyDockState() {

        if (isCollapsed) {
            // 오른쪽으로 밀어서 핸들만 조금 보이게
            dock.style.transform = "translateX(145px)";
            handle.innerText = "◀";
        } else {
            dock.style.transform = "translateX(0)";
            handle.innerText = "▶";
        }

        try {
            localStorage.setItem(
                "flacDockCollapsed",
                String(isCollapsed)
            );
        } catch (e) {}
    }


    // ========================================================
    // 핸들 클릭
    // ========================================================

    handle.addEventListener("click", () => {
        isCollapsed = !isCollapsed;
        applyDockState();
    });


    // ========================================================
    // 마우스 효과
    // ========================================================

    button.addEventListener("mouseenter", () => {

        if (button.disabled) {
            return;
        }

        button.style.transform = "translateY(-2px)";
        button.style.boxShadow =
            "0 12px 30px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.14)";
        button.style.background =
            "linear-gradient(135deg, rgba(38,41,48,0.98), rgba(64,68,80,0.98))";
    });

    button.addEventListener("mouseleave", () => {

        if (button.disabled) {
            return;
        }

        button.style.transform = "translateY(0)";
        button.style.boxShadow =
            "0 8px 24px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.10)";
        button.style.background =
            "linear-gradient(135deg, rgba(30,32,38,0.97), rgba(52,55,65,0.97))";
    });

    handle.addEventListener("mouseenter", () => {
        handle.style.transform = "translateY(-1px)";
    });

    handle.addEventListener("mouseleave", () => {
        handle.style.transform = "translateY(0)";
    });


    // ========================================================
    // 버튼 상태 변경
    // ========================================================

    function setButtonStatus(status) {

        const text = button.querySelector(".flac-text");
        const icon = button.querySelector(".flac-icon");

        if (status === "loading") {

            button.disabled = true;

            text.innerText = "변환 중...";
            icon.innerText = "···";

            button.style.cursor = "wait";
            button.style.opacity = "0.85";

            button.style.background =
                "linear-gradient(135deg, #394150, #4b5563)";
        }

        else if (status === "success") {

            button.disabled = true;

            text.innerText = "변환 완료";
            icon.innerText = "✓";

            button.style.cursor = "default";
            button.style.opacity = "1";

            button.style.background =
                "linear-gradient(135deg, #166534, #15803d)";

            setTimeout(() => {

                text.innerText = "FLAC 추출";
                icon.innerText = "♪";

                button.disabled = false;
                button.style.cursor = "pointer";

                button.style.background =
                    "linear-gradient(135deg, rgba(30,32,38,0.97), rgba(52,55,65,0.97))";

            }, 2500);
        }

        else if (status === "error") {

            button.disabled = true;

            text.innerText = "변환 실패";
            icon.innerText = "!";

            button.style.cursor = "default";
            button.style.opacity = "1";

            button.style.background =
                "linear-gradient(135deg, #991b1b, #b91c1c)";

            setTimeout(() => {

                text.innerText = "FLAC 추출";
                icon.innerText = "♪";

                button.disabled = false;
                button.style.cursor = "pointer";

                button.style.background =
                    "linear-gradient(135deg, rgba(30,32,38,0.97), rgba(52,55,65,0.97))";

            }, 3000);
        }
    }


    // ========================================================
    // 변환 버튼 클릭
    // ========================================================

    button.onclick = function () {

        console.log("========== FLAC CLICK ==========");

        const url = window.location.href;
        const title = document.title;

        let videoId = null;

        try {

            const parsedUrl = new URL(url);

            // 일반 영상
            if (parsedUrl.pathname === "/watch") {
                videoId = parsedUrl.searchParams.get("v");
            }

            // Shorts
            else if (parsedUrl.pathname.startsWith("/shorts/")) {
                videoId =
                    parsedUrl.pathname
                        .split("/shorts/")[1]
                        .split("/")[0];
            }

        } catch (error) {
            console.error("Video ID 분석 오류:", error);
        }

        const data = {
            title: title,
            url: url,
            videoId: videoId
        };

        console.log("영상 데이터:", data);

        setButtonStatus("loading");

        chrome.runtime.sendMessage(
            {
                type: "EXTRACT_FLAC",
                data: data
            },
            (response) => {

                if (chrome.runtime.lastError) {
                    console.error(
                        "메시지 전송 오류:",
                        chrome.runtime.lastError.message
                    );
                    setButtonStatus("error");
                    return;
                }

                console.log("background 응답:", response);

                if (
                    response &&
                    response.status === "success" &&
                    response.data &&
                    response.data.ok
                ) {
                    setButtonStatus("success");
                } else {
                    setButtonStatus("error");
                }
            }
        );
    };


    // ========================================================
    // 화면에 추가
    // ========================================================

    dock.appendChild(handle);
    dock.appendChild(button);
    document.body.appendChild(dock);

    applyDockState();

    console.log("슬라이드형 FLAC 버튼 생성 완료");
}


// 최초 생성
addButton();


// 유튜브 내부 페이지 이동 대응
document.addEventListener(
    "yt-navigate-finish",
    () => {
        setTimeout(addButton, 400);
    }
);