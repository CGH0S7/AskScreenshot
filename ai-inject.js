// 等待页面完全加载
(function () {
    console.log("Ask Screenshot 插件已载入");

    const AI_PLATFORM_INFO = {
        qwen: { name: "Qwen" },
        deepseek: { name: "Deepseek" },
        chatgpt: { name: "ChatGPT" },
        // gemini: { name: "Gemini" },
        kimi: { name: "Kimi" },
    };

    const MAX_UPLOAD_ATTEMPTS = 8;
    const UPLOAD_RETRY_DELAY_MS = 1000;

    const BASE_UPLOAD_SELECTORS = {
        inputs: [
            'input[type="file"][accept*="image" i]',
            'input[type="file"][accept*="png" i]',
            'input[type="file"][accept*="jpg" i]',
            'input[type="file"]',
        ],
        buttons: [
            '[data-testid*="upload" i]',
            '[data-testid*="attach" i]',
            '[class*="upload" i]',
            '[class*="attach" i]',
            'button[title*="上传" i]',
            'button[title*="upload" i]',
            'button[aria-label*="上传" i]',
            'button[aria-label*="upload" i]',
            'label[aria-label*="上传" i]',
            'label[aria-label*="upload" i]',
        ],
        dropzones: [
            '[data-testid*="drop" i]',
            '[class*="dropzone" i]',
            '[aria-label*="drag" i]',
            '[aria-label*="drop" i]',
        ],
    };

    const PLATFORM_SELECTOR_OVERRIDES = {
        // gemini: {
        //     inputs: [
        //         'input[type="file"][accept*="image/*" i]',
        //         'input[type="file"][name*="file" i]',
        //         'input[type="file"][aria-label*="image" i]',
        //     ],
        //     buttons: [
        //         'button[aria-label*="add image" i]',
        //         'button[aria-label*="add images" i]',
        //         'button[aria-label*="add files" i]',
        //         '[role="button"][aria-label*="add image" i]',
        //         '[data-tooltip*="add image" i]',
        //     ],
        //     dropzones: [
        //         '[aria-label*="drop image" i]',
        //         '[aria-label*="drop files" i]',
        //         '[data-testid*="dropzone" i]',
        //     ],
        // },
        chatgpt: {
            inputs: [
                'label[aria-label*="Upload" i] input[type="file"]',
            ],
            buttons: [
                'button[data-testid*="file-upload" i]',
                '[data-testid*="upload-button" i]',
            ],
        },
        kimi: {
            inputs: ['[class*="kimi" i] input[type="file"]'],
            buttons: ['button[aria-label*="上传" i]'],
        },
        qwen: {
            buttons: ['[class*="qwen" i]'],
        },
        deepseek: {
            buttons: ['[class*="deepseek" i]'],
        },
    };

    function getPlatformName(platformKey) {
        return AI_PLATFORM_INFO[platformKey]?.name || platformKey;
    }

    // 等待一段时间确保页面元素已载入
    setTimeout(() => {
        initializeAIIntegration();
    }, 3000);

    function initializeAIIntegration() {
        // 获取存储的截图和AI平台信息
        chrome.storage.local.get(["screenshot", "selectedAI"], (response) => {
            if (response && response.screenshot) {
                const aiPlatform = response.selectedAI || "qwen";
                const platformName = getPlatformName(aiPlatform);

                // 创建一个浮动的提示窗口
                createFloatingNotification(platformName);

                // 尝试自动上传图片
                uploadScreenshotToAI(response.screenshot, aiPlatform);
            }
        });
    }

    function createFloatingNotification(platformName) {
        const notification = document.createElement("div");

        const container = document.createElement("div");
        container.style.cssText = `
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
        `;

        const text = document.createElement("span");
        text.textContent = `📸 Ask Screenshot: 截图已准备好，正在上传到 ${platformName}...`;

        container.appendChild(text);
        notification.appendChild(container);
        document.body.appendChild(notification);

        // 5秒后自动消失
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    function uploadScreenshotToAI(screenshotDataUrl, aiPlatform) {
        convertDataUrlToFile(screenshotDataUrl, "screenshot.png")
            .then((file) => {
                attemptUploadToPlatform(file, screenshotDataUrl, aiPlatform, 1);
            })
            .catch((err) => {
                console.error("处理截图失败:", err);
                markScreenshotConsumed();
                showManualUploadPrompt(null, aiPlatform, screenshotDataUrl);
            });
    }

    function convertDataUrlToFile(dataUrl, filename) {
        return fetch(dataUrl)
            .then((res) => res.blob())
            .then(
                (blob) =>
                    new File([blob], filename, {
                        type: blob.type || "image/png",
                    })
            );
    }

    function attemptUploadToPlatform(file, dataUrl, aiPlatform, attempt) {
        const selectors = buildSelectorConfig(aiPlatform);
        const uploadTarget =
            pickFirstMatch(selectors.inputs, isFileInput) ||
            pickFirstMatch(selectors.buttons);

        if (uploadTarget && assignFileToTarget(uploadTarget, file)) {
            markScreenshotConsumed();
            return;
        }

        const dropTarget =
            pickFirstMatch(selectors.dropzones, isElementUsable) ||
            (uploadTarget && !isFileInput(uploadTarget)
                ? uploadTarget
                : null) ||
            findChatInput(aiPlatform);

        if (dropTarget && simulateFileDrop(dropTarget, file)) {
            markScreenshotConsumed();
            return;
        }

        if (attempt < MAX_UPLOAD_ATTEMPTS) {
            setTimeout(() => {
                attemptUploadToPlatform(
                    file,
                    dataUrl,
                    aiPlatform,
                    attempt + 1
                );
            }, UPLOAD_RETRY_DELAY_MS);
            return;
        }

        console.warn(
            `未能找到 ${aiPlatform} 的自动上传入口，展示手动上传提示。`
        );
        markScreenshotConsumed();
        showManualUploadPrompt(file, aiPlatform, dataUrl);
    }

    function buildSelectorConfig(aiPlatform) {
        const overrides = PLATFORM_SELECTOR_OVERRIDES[aiPlatform] || {};

        return {
            inputs: dedupeSelectors([
                ...BASE_UPLOAD_SELECTORS.inputs,
                ...(overrides.inputs || []),
            ]),
            buttons: dedupeSelectors([
                ...BASE_UPLOAD_SELECTORS.buttons,
                ...(overrides.buttons || []),
            ]),
            dropzones: dedupeSelectors([
                ...BASE_UPLOAD_SELECTORS.dropzones,
                ...(overrides.dropzones || []),
            ]),
        };
    }

    function dedupeSelectors(selectors) {
        return [...new Set(selectors.filter(Boolean))];
    }

    function pickFirstMatch(selectors, predicate = () => true) {
        for (const selector of selectors) {
            const matches = querySelectorDeep(selector);
            const candidate = matches.find(
                (el) => !isExtensionElement(el) && predicate(el)
            );
            if (candidate) {
                return candidate;
            }
        }
        return null;
    }

    function querySelectorDeep(selector) {
        const results = [];
        const collected = new Set();
        const visited = new Set();
        const queue = [document];

        while (queue.length) {
            const root = queue.shift();
            if (!root || visited.has(root)) continue;
            visited.add(root);

            if (typeof root.querySelectorAll === "function") {
                const matches = root.querySelectorAll(selector);
                matches.forEach((el) => {
                    if (!collected.has(el)) {
                        collected.add(el);
                        results.push(el);
                    }
                });

                const descendants = root.querySelectorAll("*");
                descendants.forEach((element) => {
                    if (element.shadowRoot && !visited.has(element.shadowRoot)) {
                        queue.push(element.shadowRoot);
                    }
                    if (element instanceof HTMLIFrameElement) {
                        try {
                            const doc =
                                element.contentDocument ||
                                element.contentWindow?.document;
                            if (doc && !visited.has(doc)) {
                                queue.push(doc);
                            }
                        } catch (err) {
                            // ignore cross-origin frames
                        }
                    }
                });
            }
        }

        return results;
    }

    function isExtensionElement(el) {
        return el?.id?.startsWith("ask-");
    }

    function isFileInput(element) {
        return (
            element?.tagName === "INPUT" &&
            element.getAttribute("type") === "file"
        );
    }

    function isElementUsable(element) {
        if (!element) return false;
        if (isFileInput(element)) return true;
        return isElementVisible(element);
    }

    function resolveFileInput(element) {
        if (!element) return null;
        if (isFileInput(element)) return element;

        const controlId = element.getAttribute?.("for");
        if (controlId) {
            const associated = document.getElementById(controlId);
            if (isFileInput(associated)) return associated;
        }

        if (element.querySelector) {
            const nested = element.querySelector('input[type="file"]');
            if (isFileInput(nested)) return nested;
        }

        if (element.shadowRoot) {
            const shadowNested = element.shadowRoot.querySelector(
                'input[type="file"]'
            );
            if (isFileInput(shadowNested)) return shadowNested;
        }

        let parent = element.parentElement;
        while (parent) {
            if (parent.querySelector) {
                const nested = parent.querySelector('input[type="file"]');
                if (isFileInput(nested)) return nested;
            }
            if (parent.shadowRoot) {
                const shadowNested = parent.shadowRoot.querySelector(
                    'input[type="file"]'
                );
                if (isFileInput(shadowNested)) return shadowNested;
            }
            parent = parent.parentElement;
        }

        return null;
    }

    function buildFileList(file) {
        if (typeof DataTransfer !== "undefined") {
            const dt = new DataTransfer();
            dt.items.add(file);
            return dt.files;
        }
        return null;
    }

    function assignFileToTarget(target, file) {
        try {
            const fileInput = resolveFileInput(target);
            if (!fileInput) return false;

            const fileList = buildFileList(file);
            if (!fileList) return false;

            fileInput.files = fileList;
            fileInput.dispatchEvent(new Event("input", { bubbles: true }));
            fileInput.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
        } catch (err) {
            console.error("写入文件到输入框失败:", err);
            return false;
        }
    }

    function createDataTransfer(file) {
        if (typeof DataTransfer === "undefined") return null;
        const dt = new DataTransfer();
        dt.items.add(file);
        return dt;
    }

    function simulateFileDrop(element, file) {
        if (!element) return false;
        try {
            const dragEnterDt = createDataTransfer(file);
            const dragOverDt = createDataTransfer(file);
            const dropDt = createDataTransfer(file);

            if (!dragEnterDt || !dragOverDt || !dropDt) return false;

            element.dispatchEvent(
                new DragEvent("dragenter", {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: dragEnterDt,
                })
            );
            element.dispatchEvent(
                new DragEvent("dragover", {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: dragOverDt,
                })
            );
            element.dispatchEvent(
                new DragEvent("drop", {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer: dropDt,
                })
            );
            return true;
        } catch (err) {
            console.error("模拟拖放上传失败:", err);
            return false;
        }
    }

    function markScreenshotConsumed() {
        chrome.storage.local.remove(["screenshot", "timestamp"]);
    }

    function findChatInput(aiPlatform) {
        const baseSelectors = [
            "textarea",
            'input[type="text"]',
            '[contenteditable="true"]',
            '[data-testid*="input"]',
            '[class*="input"]',
            '[role="textbox"]',
        ];

        const platformSpecific = {
            // gemini: [
            //     'textarea[aria-label*="gemini" i]',
            //     '[aria-label*="message gemini" i]',
            //     '[aria-label*="prompt" i][contenteditable="true"]',
            // ],
            chatgpt: ['textarea[data-id]', '[data-id][contenteditable="true"]'],
        };

        const selectors = baseSelectors.concat(
            platformSpecific[aiPlatform] || []
        );

        return pickFirstMatch(selectors, isElementVisible);
    }

    function isElementVisible(element) {
        if (!element) return false;
        if (element.offsetWidth > 0 && element.offsetHeight > 0) return true;
        if (typeof element.getClientRects === "function") {
            const rects = element.getClientRects();
            if (rects && rects.length > 0) return true;
        }
        const style = window.getComputedStyle(element);
        return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0"
        );
    }

    function showManualUploadPrompt(file, aiPlatform, dataUrl) {
        const platformName = getPlatformName(aiPlatform);
        const prompt = document.createElement("div");

        const container = document.createElement("div");
        container.style.cssText = `
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
        `;

        const title = document.createElement("h3");
        title.style.cssText =
            "margin: 0 0 15px 0; color: #333; text-align: center;";
        title.textContent = "📸 手动上传到 " + platformName;

        const description = document.createElement("p");
        description.style.cssText =
            "margin: 0 0 20px 0; color: #666; line-height: 1.5;";
        description.textContent =
            "自动上传功能可能不兼容当前页面版本。请使用以下方式上传截图：";

        const method1Container = document.createElement("div");
        method1Container.style.cssText =
            "background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;";

        const method1Title = document.createElement("p");
        method1Title.style.cssText =
            "margin: 0 0 10px 0; font-weight: bold; color: #333;";
        method1Title.textContent = "方法1：下载后上传";

        const method1Description = document.createElement("p");
        method1Description.style.cssText =
            "margin: 0 0 10px 0; color: #666; font-size: 14px;";
        method1Description.textContent =
            "点击下载按钮保存截图，然后手动上传到聊天框";

        const downloadLink = document.createElement("a");
        downloadLink.id = "download-screenshot";
        downloadLink.style.cssText = `
                background: #007bff;
                color: white;
                text-decoration: none;
                padding: 8px 16px;
                border-radius: 4px;
                display: inline-block;
                font-size: 14px;
            `;

        let objectUrl = null;
        if (file) {
            objectUrl = URL.createObjectURL(file);
            downloadLink.href = objectUrl;
            downloadLink.download = file.name || "screenshot.png";
            downloadLink.textContent = "下载截图";
        } else if (dataUrl) {
            downloadLink.href = dataUrl;
            downloadLink.download = "screenshot.png";
            downloadLink.textContent = "下载截图";
        } else {
            downloadLink.href = "#";
            downloadLink.setAttribute("aria-disabled", "true");
            downloadLink.style.opacity = "0.6";
            downloadLink.style.pointerEvents = "none";
            downloadLink.textContent = "无法提供截图下载";
        }
        method1Container.appendChild(downloadLink);

        const method2Container = document.createElement("div");
        method2Container.style.cssText =
            "background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;";

        const method2Title = document.createElement("p");
        method2Title.style.cssText =
            "margin: 0 0 10px 0; font-weight: bold; color: #333;";
        method2Title.textContent = "方法2：拖拽上传";

        const method2Description = document.createElement("p");
        method2Description.style.cssText =
            "margin: 0 0 10px 0; color: #666; font-size: 14px;";
        method2Description.textContent = `将截图文件直接拖拽到 ${platformName} 的聊天输入框中`;

        const buttonContainer = document.createElement("div");
        buttonContainer.style.cssText = "text-align: center; margin-top: 20px;";

        const closeButton = document.createElement("button");
        closeButton.id = "close-prompt";
        closeButton.style.cssText = `
            background: #6c757d;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
        `;
        closeButton.textContent = "关闭";

        method1Container.appendChild(method1Title);
        method1Container.appendChild(method1Description);
        method2Container.appendChild(method2Title);
        method2Container.appendChild(method2Description);
        buttonContainer.appendChild(closeButton);

        container.appendChild(title);
        container.appendChild(description);
        container.appendChild(method1Container);
        container.appendChild(method2Container);
        container.appendChild(buttonContainer);
        prompt.appendChild(container);
        document.body.appendChild(prompt);

        // 添加关闭按钮事件
        closeButton.addEventListener("click", () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
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
