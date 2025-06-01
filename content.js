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
    notification.innerHTML = `
    <div style="
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
    ">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 20px; margin-right: 8px;">🤖</span>
        <strong>Ask Screenshot 助手</strong>
      </div>
      <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.4;">
        截图已准备就绪！将上传到 ${platformNames[platform]}，你可以：
      </p>
      <div style="display: flex; gap: 8px;">
        <button id="auto-upload-btn" style="
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        ">重新自动上传</button>
        <button id="manual-upload-btn" style="
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        ">手动处理</button>
        <button id="close-notification-btn" style="
          background: rgba(255,255,255,0.1);
          color: white;
          border: 1px solid rgba(255,255,255,0.2);
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
        ">关闭</button>
      </div>
    </div>
  `;

    // 添加CSS动画
    if (!document.querySelector("#ask-screenshot-styles")) {
        const styles = document.createElement("style");
        styles.id = "ask-screenshot-styles";
        styles.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .ask-screenshot-notification button:hover {
        background: rgba(255,255,255,0.3) !important;
        transform: translateY(-1px);
      }
    `;
        document.head.appendChild(styles);
    }

    document.body.appendChild(notification);

    // 添加事件监听器
    document.getElementById("auto-upload-btn").addEventListener("click", () => {
        attemptAutoUpload(screenshotDataUrl, platform);
        notification.remove();
    });

    document
        .getElementById("manual-upload-btn")
        .addEventListener("click", () => {
            showManualUploadHelper(screenshotDataUrl, platform);
            notification.remove();
        });

    document
        .getElementById("close-notification-btn")
        .addEventListener("click", () => {
            notification.remove();
            // 清除截图数据
            chrome.storage.local.remove([
                "screenshot",
                "timestamp",
                "selectedAI",
            ]);
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
    helper.innerHTML = `
    <div style="
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
    ">
      <h3 style="margin: 0 0 12px 0; color: #333; font-size: 16px;">
        📸 手动上传截图到 ${platformNames[platform]}
      </h3>
      <p style="margin: 0 0 15px 0; color: #666; font-size: 14px; line-height: 1.4;">
        请点击下载按钮保存截图，然后手动上传到聊天中。
      </p>
      <div style="display: flex; gap: 8px;">
        <a id="download-screenshot" href="${screenshotDataUrl}" download="ask-screenshot.png" style="
          background: #4CAF50;
          color: white;
          text-decoration: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          display: inline-block;
        ">下载截图</a>
        <button onclick="this.closest('div').parentNode.remove()" style="
          background: #f44336;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">关闭</button>
      </div>
    </div>
  `;

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
    successEl.innerHTML = `
    <div style="
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
    ">
      ✅ ${message}
    </div>
  `;

    document.body.appendChild(successEl);

    // 3秒后自动消失
    setTimeout(() => {
        if (successEl.parentNode) {
            successEl.remove();
        }
    }, 3000);
}
