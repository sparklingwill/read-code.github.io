
// Unified Opener for External Agents
window.agentWindows = window.agentWindows || {};

window.openExternalAgent = (agentKey) => {
    const url = agentUrls[agentKey];
    if (!url) return;

    const popupWindowName = `${agentKey}Window`;
    const existingWin = window.agentWindows[agentKey];

    if (existingWin && !existingWin.closed) {
        existingWin.focus();
    } else {
        const popupFeatures = "width=600,height=900,scrollbars=yes,resizable=yes,status=no,toolbar=no,menubar=no";
        window.agentWindows[agentKey] = window.open(url, popupWindowName, popupFeatures);
    }
};
