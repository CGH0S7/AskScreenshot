// 内容脚本 - 在所有页面中运行
console.log("Ask Screenshot content script loaded");

// 监听来自background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "prepareScreenshot") {
        // 如果需要在截图前做任何准备工作，可以在这里处理
        sendResponse({ status: "ready" });
    }
});

// 检查当前页面是否为支持的AI平台
const supportedPlatforms = {
    "chat.qwen.ai": "qwen",
    "chat.deepseek.com": "deepseek",
};

const currentPlatform = supportedPlatforms[window.location.hostname];

if (currentPlatform) {
    // 监听页面加载完成
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () =>
            handleAIPage(currentPlatform)
        );
    } else {
        handleAIPage(currentPlatform);
    }
}

function handleAIPage(platform) {
    const platformNames = {
        qwen: "Qwen",
        deepseek: "Deepseek",
    };

    console.log(`在 ${platformNames[platform]} 页面中`);

    // 检查是否有等待处理的截图
    chrome.storage.local.get(
        ["screenshot", "timestamp", "selectedAI"],
        (result) => {
            if (result.screenshot && result.timestamp) {
                const now = Date.now();
                const screenshotAge = now - result.timestamp;

                // 只处理5分钟内的截图，并且确保平台匹配
                if (
                    screenshotAge < 5 * 60 * 1000 &&
                    (!result.selectedAI || result.selectedAI === platform)
                ) {
                    console.log("发现待处理的截图");
                    // 延迟执行，确保页面完全载入
                    setTimeout(() => {
                        processScreenshotForAI(result.screenshot, platform);
                    }, 2000);
                } else {
                    // 清除过期的或不匹配的截图
                    chrome.storage.local.remove([
                        "screenshot",
                        "timestamp",
                        "selectedAI",
                    ]);
                }
            }
        }
    );
}

function processScreenshotForAI(screenshotDataUrl, platform) {
    const platformNames = {
        qwen: "Qwen",
        deepseek: "Deepseek",
    };

    // 创建提示用户的浮动元素
    const notification = document.createElement("div");
    notification.className = "ask-screenshot-notification";

    const container = document.createElement("div");
    container.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 12px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        max-width: 320px;
        animation: slideIn 0.3s ease-out;
    `;

    const headerContainer = document.createElement("div");
    headerContainer.style.cssText =
        "display: flex; align-items: center; margin-bottom: 8px;";

    const emojiSpan = document.createElement("span");
    emojiSpan.style.cssText = "font-size: 20px; margin-right: 8px;";
    emojiSpan.textContent = "🤖";

    const title = document.createElement("strong");
    title.textContent = "Ask Screenshot 助手";

    const description = document.createElement("p");
    description.style.cssText =
        "margin: 0 0 12px 0; font-size: 14px; line-height: 1.4;";
    description.textContent = `截图已准备就绪！将上传到 ${platformNames[platform]}，你可以：`;

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = "display: flex; gap: 8px;";

    const manualUploadBtn = document.createElement("button");
    manualUploadBtn.id = "manual-upload-btn";
    manualUploadBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
    `;
    manualUploadBtn.textContent = "手动上传";

    const closeBtn = document.createElement("button");
    closeBtn.id = "close-notification-btn";
    closeBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
    `;
    closeBtn.textContent = "关闭";

    headerContainer.appendChild(emojiSpan);
    headerContainer.appendChild(title);
    buttonContainer.appendChild(manualUploadBtn);
    buttonContainer.appendChild(closeBtn);

    container.appendChild(headerContainer);
    container.appendChild(description);
    container.appendChild(buttonContainer);
    notification.appendChild(container);
    document.body.appendChild(notification);

    // 添加动画样式
    if (!document.querySelector("#ask-screenshot-notification-styles")) {
        const styles = document.createElement("style");
        styles.id = "ask-screenshot-notification-styles";
        styles.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }

    // 添加事件监听器
    manualUploadBtn.addEventListener("click", () => {
        showManualUploadHelper(screenshotDataUrl, platform);
        notification.remove();
    });

    closeBtn.addEventListener("click", () => {
        notification.remove();
        // 清除截图数据
        chrome.storage.local.remove(["screenshot", "timestamp", "selectedAI"]);
    });

    // 10秒后自动消失
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function attemptAutoUpload(screenshotDataUrl, platform) {
    // 将截图转换为文件
    fetch(screenshotDataUrl)
        .then((res) => res.blob())
        .then((blob) => {
            const file = new File([blob], "ask-screenshot.png", {
                type: "image/png",
            });

            // 寻找上传元素，根据平台使用不同策略
            let uploadElements = [
                ...document.querySelectorAll('input[type="file"]'),
                ...document.querySelectorAll('[data-testid*="upload"]'),
                ...document.querySelectorAll('[class*="upload" i]'),
                ...document.querySelectorAll('[class*="attach" i]'),
            ];

            // 根据平台添加特定选择器
            if (platform === "qwen") {
                uploadElements = uploadElements.concat([
                    ...document.querySelectorAll('[class*="qwen" i]'),
                ]);
            } else if (platform === "deepseek") {
                uploadElements = uploadElements.concat([
                    ...document.querySelectorAll('[class*="deepseek" i]'),
                ]);
            }

            if (uploadElements.length > 0) {
                // 尝试使用找到的第一个上传元素
                const uploadElement = uploadElements[0];

                if (uploadElement.tagName === "INPUT") {
                    // 文件输入框
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    uploadElement.files = dt.files;
                    uploadElement.dispatchEvent(
                        new Event("change", { bubbles: true })
                    );

                    showSuccessMessage("截图已上传成功！");
                } else {
                    // 其他类型的上传区域，尝试拖放
                    simulateFileDrop(uploadElement, file);
                }
            } else {
                // 找不到上传元素，回退到手动方式
                showManualUploadHelper(screenshotDataUrl, platform);
            }
        })
        .catch((err) => {
            console.error("自动上传失败:", err);
            showManualUploadHelper(screenshotDataUrl, platform);
        });
}

function simulateFileDrop(element, file) {
    const dt = new DataTransfer();
    dt.items.add(file);

    const dropEvent = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
    });

    element.dispatchEvent(dropEvent);
    showSuccessMessage("截图已通过拖放上传！");
}

function showManualUploadHelper(screenshotDataUrl, platform) {
    const platformNames = {
        qwen: "Qwen",
        deepseek: "Deepseek",
    };

    // 创建一个下载链接让用户手动下载截图
    const helper = document.createElement("div");

    const container = document.createElement("div");
    container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        border: 2px solid #ddd;
        padding: 20px;
        border-radius: 12px;
        z-index: 999999;
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        max-width: 300px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const title = document.createElement("h3");
    title.style.cssText = "margin: 0 0 12px 0; color: #333; font-size: 16px;";
    title.textContent = `📸 手动上传截图到 ${platformNames[platform]}`;

    const description = document.createElement("p");
    description.style.cssText =
        "margin: 0 0 15px 0; color: #666; font-size: 14px; line-height: 1.4;";
    description.textContent = "请点击下载按钮保存截图，然后手动上传到聊天中。";

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = "display: flex; gap: 8px;";

    const downloadLink = document.createElement("a");
    downloadLink.id = "download-screenshot";
    downloadLink.href = screenshotDataUrl;
    downloadLink.download = "ask-screenshot.png";
    downloadLink.style.cssText = `
        background: #4CAF50;
        color: white;
        text-decoration: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        display: inline-block;
    `;
    downloadLink.textContent = "下载截图";

    const closeButton = document.createElement("button");
    closeButton.style.cssText = `
        background: #f44336;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
    `;
    closeButton.textContent = "关闭";
    closeButton.addEventListener("click", () => {
        helper.remove();
    });

    buttonContainer.appendChild(downloadLink);
    buttonContainer.appendChild(closeButton);

    container.appendChild(title);
    container.appendChild(description);
    container.appendChild(buttonContainer);
    helper.appendChild(container);
    document.body.appendChild(helper);

    // 10秒后自动消失
    setTimeout(() => {
        if (helper.parentNode) {
            helper.remove();
        }
    }, 10000);
}

function showSuccessMessage(message) {
    const successEl = document.createElement("div");

    const container = document.createElement("div");
    container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 1000000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
    `;

    const checkmark = document.createElement("span");
    checkmark.textContent = "✅ ";

    const messageText = document.createElement("span");
    messageText.textContent = message;

    container.appendChild(checkmark);
    container.appendChild(messageText);
    successEl.appendChild(container);
    document.body.appendChild(successEl);

    // 3秒后自动消失
    setTimeout(() => {
        if (successEl.parentNode) {
            successEl.remove();
        }
    }, 3000);
}
