// 等待页面完全加载
(function () {
    console.log("Ask Screenshot 插件已载入");

    // 等待一段时间确保页面元素已载入
    setTimeout(() => {
        initializeAIIntegration();
    }, 3000);

    function initializeAIIntegration() {
        // 获取存储的截图和AI平台信息
        chrome.storage.local.get(["screenshot", "selectedAI"], (response) => {
            if (response && response.screenshot) {
                const aiPlatform = response.selectedAI || "qwen";
                const platformName =
                    aiPlatform === "qwen" ? "Qwen" : "Deepseek";

                // 创建一个浮动的提示窗口
                createFloatingNotification(platformName);

                // 尝试自动上传图片
                uploadScreenshotToAI(response.screenshot, aiPlatform);
            }
        });
    }

    function createFloatingNotification(platformName) {
        const notification = document.createElement("div");
        notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-family: Arial, sans-serif;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        cursor: pointer;
      ">
        📸 Ask Screenshot: 截图已准备好，正在上传到 ${platformName}...
      </div>
    `;

        document.body.appendChild(notification);

        // 5秒后自动消失
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    function uploadScreenshotToAI(screenshotDataUrl, aiPlatform) {
        // 将dataUrl转换为File对象
        fetch(screenshotDataUrl)
            .then((res) => res.blob())
            .then((blob) => {
                const file = new File([blob], "screenshot.png", {
                    type: "image/png",
                });

                // 尝试找到文件上传按钮或拖放区域
                const uploadButton = findUploadButton(aiPlatform);
                const chatInput = findChatInput(aiPlatform);

                if (uploadButton) {
                    // 模拟文件上传
                    simulateFileUpload(uploadButton, file);
                } else if (chatInput) {
                    // 如果找不到上传按钮，创建一个临时的上传区域
                    createTemporaryUploadArea(file, chatInput, aiPlatform);
                } else {
                    // 如果都找不到，显示手动上传提示
                    showManualUploadPrompt(file, aiPlatform);
                }
            })
            .catch((err) => {
                console.error("处理截图失败:", err);
                // showManualUploadPrompt(null, aiPlatform);
            });
    }

    function findUploadButton(aiPlatform) {
        // 寻找可能的上传按钮，根据不同平台使用不同选择器
        let selectors = [
            'input[type="file"]',
            '[data-testid*="upload"]',
            '[class*="upload"]',
            '[class*="attach"]',
            'button[title*="上传"]',
            'button[title*="upload"]',
        ];

        // 根据平台添加特定选择器
        if (aiPlatform === "qwen") {
            selectors = selectors.concat([
                '[class*="qwen"]',
                '[data-testid*="qwen"]',
            ]);
        } else if (aiPlatform === "deepseek") {
            selectors = selectors.concat([
                '[class*="deepseek"]',
                '[data-testid*="deepseek"]',
            ]);
        }

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return null;
    }

    function findChatInput(aiPlatform) {
        // 寻找聊天输入框
        const selectors = [
            "textarea",
            'input[type="text"]',
            '[contenteditable="true"]',
            '[data-testid*="input"]',
            '[class*="input"]',
            '[role="textbox"]',
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.offsetHeight > 0) return element;
        }
        return null;
    }

    function simulateFileUpload(uploadElement, file) {
        // 创建一个DataTransfer对象来模拟文件上传
        const dt = new DataTransfer();
        dt.items.add(file);

        if (uploadElement.tagName === "INPUT") {
            uploadElement.files = dt.files;
            uploadElement.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
            // 模拟拖放事件
            const dropEvent = new DragEvent("drop", {
                bubbles: true,
                dataTransfer: dt,
            });
            uploadElement.dispatchEvent(dropEvent);
        }
    }

    function createTemporaryUploadArea(file, nearElement, aiPlatform) {
        const platformName = aiPlatform === "qwen" ? "Qwen" : "Deepseek";
        const uploadArea = document.createElement("div");
        uploadArea.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        border: 2px dashed #ccc;
        padding: 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        max-width: 300px;
      ">
        <h3 style="margin: 0 0 10px 0; color: #333;">Ask Screenshot 截图</h3>
        <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
          点击下方按钮上传截图到 ${platformName} 对话中
        </p>
        <button id="ai-upload-btn" style="
          background: #4CAF50;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 10px;
        ">上传截图</button>
        <button id="ai-cancel-btn" style="
          background: #f44336;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
        ">取消</button>
      </div>
    `;

        document.body.appendChild(uploadArea);

        // 添加事件监听器
        document
            .getElementById("ai-upload-btn")
            .addEventListener("click", () => {
                // 创建一个隐藏的文件输入框
                const hiddenInput = document.createElement("input");
                hiddenInput.type = "file";
                hiddenInput.style.display = "none";

                // 模拟文件选择
                const dt = new DataTransfer();
                dt.items.add(file);
                hiddenInput.files = dt.files;

                document.body.appendChild(hiddenInput);
                hiddenInput.click();

                uploadArea.remove();
            });

        document
            .getElementById("ai-cancel-btn")
            .addEventListener("click", () => {
                uploadArea.remove();
            });
    }

    function showManualUploadPrompt(file, aiPlatform) {
        const platformName = aiPlatform === "qwen" ? "Qwen" : "Deepseek";
        const prompt = document.createElement("div");
        prompt.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 1px solid #ddd;
        padding: 30px;
        border-radius: 12px;
        z-index: 10000;
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        max-width: 400px;
        font-family: Arial, sans-serif;
      ">
        <h3 style="margin: 0 0 15px 0; color: #333; text-align: center;">
          📸 手动上传到 ${platformName}
        </h3>
        <p style="margin: 0 0 20px 0; color: #666; line-height: 1.5;">
          自动上传功能可能不兼容当前页面版本。请使用以下方式上传截图：
        </p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #333;">方法1：下载后上传</p>
          <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
            点击下载按钮保存截图，然后手动上传到聊天框
          </p>
          ${
              file
                  ? `<a id="download-screenshot" href="${URL.createObjectURL(
                        file
                    )}" download="screenshot.png" style="
            background: #007bff;
            color: white;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 4px;
            display: inline-block;
            font-size: 14px;
          ">下载截图</a>`
                  : ""
          }
        </div>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #333;">方法2：拖拽上传</p>
          <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
            将截图文件直接拖拽到 ${platformName} 的聊天输入框中
          </p>
        </div>
        <div style="text-align: center; margin-top: 20px;">
          <button id="close-prompt" style="
            background: #6c757d;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
          ">关闭</button>
        </div>
      </div>
    `;

        document.body.appendChild(prompt);

        // 添加关闭按钮事件
        document
            .getElementById("close-prompt")
            .addEventListener("click", () => {
                prompt.remove();
                // 清除存储的截图数据
                chrome.storage.local.remove([
                    "screenshot",
                    "timestamp",
                    "selectedAI",
                ]);
            });
    }
})();
