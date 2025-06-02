// 截图选择器 - 让用户手动选择截图区域
(function () {
    "use strict";

    // 防止重复初始化
    if (window.askScreenshotSelector) {
        return;
    }
    window.askScreenshotSelector = true;

    let isSelecting = false;
    let startX = 0;
    let startY = 0;
    let selectionBox = null;
    let overlay = null;
    let instructions = null;

    // 初始化截图选择器
    function initScreenshotSelector() {
        createOverlay();
        createInstructions();
        addEventListeners();
    }

    // 创建半透明遮罩层
    function createOverlay() {
        overlay = document.createElement("div");
        overlay.id = "ask-screenshot-overlay";
        overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.3);
      z-index: 999998;
      cursor: crosshair;
      user-select: none;
    `;
        document.body.appendChild(overlay);
    }

    // 创建操作说明
    function createInstructions() {
        instructions = document.createElement("div");
        instructions.id = "ask-screenshot-instructions";

        const container = document.createElement("div");
        container.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 25px;
            border-radius: 25px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 8px 25px rgba(0,0,0,0.2);
            text-align: center;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        `;

        const flexContainer = document.createElement("div");
        flexContainer.style.cssText =
            "display: flex; align-items: center; justify-content: center; gap: 10px;";

        const emojiSpan = document.createElement("span");
        emojiSpan.style.fontSize = "20px";
        emojiSpan.textContent = "📸";

        const textContainer = document.createElement("div");

        const title = document.createElement("div");
        title.style.cssText = "font-weight: bold; margin-bottom: 4px;";
        title.textContent = "Ask Screenshot 截图选择";

        const subtitle = document.createElement("div");
        subtitle.style.cssText = "font-size: 12px; opacity: 0.9;";
        subtitle.textContent = "拖拽选择截图区域，或点击取消";

        const cancelBtn = document.createElement("button");
        cancelBtn.id = "cancel-screenshot";
        cancelBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 6px 12px;
            border-radius: 15px;
            cursor: pointer;
            font-size: 12px;
            margin-left: 10px;
            transition: all 0.2s;
        `;
        cancelBtn.textContent = "取消";

        textContainer.appendChild(title);
        textContainer.appendChild(subtitle);
        flexContainer.appendChild(emojiSpan);
        flexContainer.appendChild(textContainer);
        flexContainer.appendChild(cancelBtn);
        container.appendChild(flexContainer);
        instructions.appendChild(container);
        document.body.appendChild(instructions);

        // 取消按钮事件
        cancelBtn.addEventListener("click", cancelSelection);
    }

    // 创建选择框
    function createSelectionBox(x, y) {
        selectionBox = document.createElement("div");
        selectionBox.id = "ask-screenshot-selection-box";
        selectionBox.style.cssText = `
      position: fixed;
      border: 2px solid #4CAF50;
      background: rgba(76, 175, 80, 0.1);
      z-index: 999999;
      pointer-events: none;
      box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
    `;

        selectionBox.style.left = x + "px";
        selectionBox.style.top = y + "px";
        selectionBox.style.width = "0px";
        selectionBox.style.height = "0px";

        document.body.appendChild(selectionBox);
    }

    // 更新选择框大小
    function updateSelectionBox(currentX, currentY) {
        if (!selectionBox) return;

        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);

        selectionBox.style.left = left + "px";
        selectionBox.style.top = top + "px";
        selectionBox.style.width = width + "px";
        selectionBox.style.height = height + "px";
    }

    // 添加事件监听器
    function addEventListeners() {
        overlay.addEventListener("mousedown", handleMouseDown);
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("keydown", handleKeyDown);
    }

    // 鼠标按下事件
    function handleMouseDown(e) {
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        createSelectionBox(startX, startY);
        e.preventDefault();
    }

    // 鼠标移动事件
    function handleMouseMove(e) {
        if (!isSelecting) return;
        updateSelectionBox(e.clientX, e.clientY);
        e.preventDefault();
    }

    // 鼠标释放事件
    function handleMouseUp(e) {
        if (!isSelecting) return;

        const endX = e.clientX;
        const endY = e.clientY;

        // 计算选择区域
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);

        // 如果选择区域太小，取消选择
        if (width < 20 || height < 20) {
            showMessage("选择区域太小，请重新选择", "warning");
            removeSelectionBox();
            isSelecting = false;
            return;
        }

        const left = Math.min(startX, endX);
        const top = Math.min(startY, endY);

        // 确认选择
        confirmSelection({
            x: left,
            y: top,
            width: width,
            height: height,
        });

        isSelecting = false;
        e.preventDefault();
    }

    // 键盘事件（ESC 取消）
    function handleKeyDown(e) {
        if (e.key === "Escape") {
            cancelSelection();
        }
    }

    // 确认选择
    function confirmSelection(selection) {
        const confirmDialog = document.createElement("div");

        const container = document.createElement("div");
        container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 25px;
            border-radius: 15px;
            z-index: 1000000;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center;
            min-width: 300px;
        `;

        const title = document.createElement("h3");
        title.style.cssText =
            "margin: 0 0 15px 0; color: #333; font-size: 18px;";
        title.textContent = "📸 确认截图区域";

        const description = document.createElement("p");
        description.style.cssText =
            "margin: 0 0 20px 0; color: #666; font-size: 14px;";
        description.textContent = `将截取 ${selection.width}×${selection.height} 像素的区域`;

        const buttonContainer = document.createElement("div");
        buttonContainer.style.cssText =
            "display: flex; gap: 10px; justify-content: center;";

        const confirmBtn = document.createElement("button");
        confirmBtn.id = "confirm-capture";
        confirmBtn.style.cssText = `
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        `;
        confirmBtn.textContent = "确认截图";

        const reselectBtn = document.createElement("button");
        reselectBtn.id = "reselect-area";
        reselectBtn.style.cssText = `
            background: #2196F3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
        `;
        reselectBtn.textContent = "重新选择";

        const cancelBtn = document.createElement("button");
        cancelBtn.id = "cancel-capture";
        cancelBtn.style.cssText = `
            background: #f44336;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
        `;
        cancelBtn.textContent = "取消";

        buttonContainer.appendChild(confirmBtn);
        buttonContainer.appendChild(reselectBtn);
        buttonContainer.appendChild(cancelBtn);

        container.appendChild(title);
        container.appendChild(description);
        container.appendChild(buttonContainer);
        confirmDialog.appendChild(container);
        document.body.appendChild(confirmDialog);

        // 添加事件监听器
        confirmBtn.addEventListener("click", () => {
            hideUIElements();
            confirmDialog.remove();
            captureSelectedArea(selection);
        });

        reselectBtn.addEventListener("click", () => {
            confirmDialog.remove();
            removeSelectionBox();
            createSelectionBox(0, 0);
        });

        cancelBtn.addEventListener("click", () => {
            confirmDialog.remove();
            cleanup();
        });
    }

    // 截取选定区域
    function captureSelectedArea(selection) {
        showMessage("正在截取选定区域...", "info");

        // 在截图前隐藏所有UI元素，避免它们出现在截图中
        hideUIElements();

        // 等待一小段时间确保UI元素完全隐藏
        setTimeout(() => {
            // 请求后台截取整个页面
            chrome.runtime.sendMessage(
                { action: "captureSelectedArea" },
                (response) => {
                    if (chrome.runtime.lastError) {
                        showMessage(
                            "连接后台脚本失败: " +
                                chrome.runtime.lastError.message,
                            "error"
                        );
                        cleanup();
                        return;
                    }

                    if (!response) {
                        showMessage("后台脚本无响应", "error");
                        cleanup();
                        return;
                    }

                    if (response.error) {
                        showMessage("截图失败: " + response.error, "error");
                        console.error("截图API错误:", response.error);
                        cleanup();
                        return;
                    }

                    if (!response.screenshot) {
                        showMessage("截图数据为空", "error");
                        cleanup();
                        return;
                    }

                    // 在canvas中裁剪选定区域
                    cropImage(response.screenshot, selection);
                }
            );
        }, 100); // 等待100毫秒确保UI元素隐藏
    }

    // 裁剪图片
    function cropImage(fullScreenshot, selection) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();

        img.onload = function () {
            // 计算设备像素比
            const devicePixelRatio = window.devicePixelRatio || 1;

            // 设置画布大小
            canvas.width = selection.width * devicePixelRatio;
            canvas.height = selection.height * devicePixelRatio;

            // 裁剪图片
            ctx.drawImage(
                img,
                selection.x * devicePixelRatio,
                selection.y * devicePixelRatio,
                selection.width * devicePixelRatio,
                selection.height * devicePixelRatio,
                0,
                0,
                canvas.width,
                canvas.height
            );

            // 转换为数据URL
            const croppedDataUrl = canvas.toDataURL("image/png");

            // 立即清理界面，避免任何UI元素干扰
            cleanup();

            // 发送截图数据并打开弹出窗口
            chrome.runtime.sendMessage({
                action: "openAIPopup",
                screenshot: croppedDataUrl,
            });

            // 显示成功消息（在新的上下文中）
            setTimeout(() => {
                showMessage("截图完成！正在打开 AI 助手...", "success");
            }, 100);
        };

        img.src = fullScreenshot;
    }

    // 取消选择
    function cancelSelection() {
        cleanup();
    }

    // 移除选择框
    function removeSelectionBox() {
        if (selectionBox) {
            selectionBox.remove();
            selectionBox = null;
        }
    }

    // 隐藏所有UI元素（用于截图前）
    function hideUIElements() {
        // 隐藏选择框
        if (selectionBox) {
            selectionBox.style.display = "none";
        }

        // 隐藏遮罩层
        if (overlay) {
            overlay.style.display = "none";
        }

        // 隐藏操作说明
        if (instructions) {
            instructions.style.display = "none";
        }

        // 隐藏所有可能存在的消息框和对话框
        const messageElements = document.querySelectorAll(
            '[id*="ask-screenshot"]'
        );
        messageElements.forEach((el) => {
            if (el.style) {
                el.style.display = "none";
            }
        });
    }

    // 清理所有元素
    function cleanup() {
        if (overlay) overlay.remove();
        if (instructions) instructions.remove();
        if (selectionBox) selectionBox.remove();

        // 移除事件监听器
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("keydown", handleKeyDown);

        // 重置状态
        window.askScreenshotSelector = false;
    }

    // 显示消息
    function showMessage(message, type = "info") {
        const colors = {
            info: "#2196F3",
            success: "#4CAF50",
            warning: "#FF9800",
            error: "#f44336",
        };

        const messageEl = document.createElement("div");
        const container = document.createElement("div");
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000001;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideInRight 0.3s ease-out;
        `;
        container.textContent = message;
        messageEl.appendChild(container);

        // 添加动画样式
        if (!document.querySelector("#ask-screenshot-message-styles")) {
            const styles = document.createElement("style");
            styles.id = "ask-screenshot-message-styles";
            styles.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(messageEl);

        // 3秒后自动消失
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 3000);
    }

    // 初始化
    initScreenshotSelector();
})();
