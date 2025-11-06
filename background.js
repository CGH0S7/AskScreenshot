const AI_MENU_CONFIG = {
    askQwen: { key: "qwen", title: "Ask Qwen", url: "https://chat.qwen.ai" },
    askDeepseek: {
        key: "deepseek",
        title: "Ask Deepseek",
        url: "https://chat.deepseek.com",
    },
    askChatGPT: {
        key: "chatgpt",
        title: "Ask ChatGPT",
        url: "https://chatgpt.com",
    },
    // askGemini: {
        // key: "gemini",
        // title: "Ask Gemini",
        // url: "https://gemini.google.com/app",
    // },
    askKimi: {
        key: "kimi",
        title: "Ask Kimi",
        url: "https://www.kimi.com",
    },
};

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(() => {
        Object.entries(AI_MENU_CONFIG).forEach(([id, config]) => {
            chrome.contextMenus.create({
                id,
                title: config.title,
                contexts: ["page", "selection", "image", "link"],
            });
        });
    });
});

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (AI_MENU_CONFIG[info.menuItemId]) {
        const { key: aiKey } = AI_MENU_CONFIG[info.menuItemId];

        // 存储用户选择的AI平台
        chrome.storage.local.set({
            selectedAI: aiKey,
        });

        // 向当前页面注入截图选择工具
        chrome.tabs.executeScript(
            tab.id,
            {
                file: "screenshot-selector.js",
            },
            () => {
                if (chrome.runtime.lastError) {
                    console.error(
                        "注入截图选择器失败:",
                        chrome.runtime.lastError.message
                    );
                    return;
                }
            }
        );
    }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getScreenshot") {
        chrome.storage.local.get(["screenshot"], (result) => {
            sendResponse({ screenshot: result.screenshot });
        });
        return true; // 保持消息通道开放
    }

    if (request.action === "captureSelectedArea") {
        // 截取整个页面，然后在前端裁剪
        // 先尝试获取窗口ID，如果失败则使用当前活动窗口
        chrome.tabs.get(sender.tab.id, (tab) => {
            if (chrome.runtime.lastError) {
                // 如果无法获取标签页信息，尝试截取当前活动窗口
                chrome.tabs.captureVisibleTab(
                    null,
                    { format: "png" },
                    (dataUrl) => {
                        if (chrome.runtime.lastError) {
                            sendResponse({
                                error: chrome.runtime.lastError.message,
                            });
                            return;
                        }
                        sendResponse({ screenshot: dataUrl });
                    }
                );
                return;
            }

            // 使用正确的窗口ID进行截图
            chrome.tabs.captureVisibleTab(
                tab.windowId,
                { format: "png" },
                (dataUrl) => {
                    if (chrome.runtime.lastError) {
                        // 如果指定窗口ID失败，回退到当前活动窗口
                        chrome.tabs.captureVisibleTab(
                            null,
                            { format: "png" },
                            (fallbackDataUrl) => {
                                if (chrome.runtime.lastError) {
                                    sendResponse({
                                        error: chrome.runtime.lastError.message,
                                    });
                                    return;
                                }
                                sendResponse({ screenshot: fallbackDataUrl });
                            }
                        );
                        return;
                    }
                    sendResponse({ screenshot: dataUrl });
                }
            );
        });
        return true;
    }

    if (request.action === "openAIPopup") {
        // 获取用户选择的AI平台
        chrome.storage.local.get(["selectedAI"], (aiResult) => {
            const selectedAI = aiResult.selectedAI || "qwen";
            const aiEntry = Object.values(AI_MENU_CONFIG).find(
                (item) => item.key === selectedAI
            );
            const aiUrl = aiEntry ? aiEntry.url : AI_MENU_CONFIG.askQwen.url;

            // 存储截图数据和AI平台信息
            chrome.storage.local.set(
                {
                    screenshot: request.screenshot,
                    timestamp: Date.now(),
                    selectedAI: selectedAI,
                },
                () => {
                    // 创建弹出窗口
                    chrome.windows.create(
                        {
                            url: aiUrl,
                            type: "popup",
                            width: 800,
                            height: 700,
                            left: 100,
                            top: 100,
                        },
                        (window) => {
                            // 等待窗口载入完成
                            chrome.tabs.onUpdated.addListener(function listener(
                                tabId,
                                info
                            ) {
                                if (
                                    tabId === window.tabs[0].id &&
                                    info.status === "complete"
                                ) {
                                    chrome.tabs.onUpdated.removeListener(
                                        listener
                                    );

                                    // 注入脚本来处理图片上传
                                    chrome.tabs.executeScript(
                                        window.tabs[0].id,
                                        {
                                            file: "ai-inject.js",
                                        }
                                    );
                                }
                            });
                        }
                    );
                }
            );
        });
    }
});
