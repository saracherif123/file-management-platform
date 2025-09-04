import config from './config.js';

export const DEPLOY = config.deploy;
const IP = config.host;
const PORT = config.port;
const PROTOCOL = config.protocol;

function buildRestUri(endpoint, param = "") {
    return PROTOCOL + "://" + IP + ((PORT > 0 ? ":" + PORT : "")) + "/rest/" + endpoint + ((param === "") ? "" : "/" + param);
}

if (config.logging) {
    // Logging disabled for cleaner console output
}

export var changeDisplayedPage = { callback: () => {} };

function doRequest(method, url, data, next) {
    return fetch(url, {
        method: method,
        mode: (DEPLOY ? "same-origin" : "cors"),
        credentials: "include",
        body: JSON.stringify(data),
        headers: {
            "Content-Type": "application/json",
        },
    }).then((response) => {
        if (response.status !== 200 && response.status !== 418) {
            if (response.status === 401) {
                throw new Error('Session expired, not logged in!');
            }
            throw new Error('Bad status code from server: ' + response.status);
        }
        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('text/plain')) {
            return handleStreamingResponse(response, next);
        } else if (contentType.includes('image/png')) {
            return handleImageResponse(response, next);
        } else {
            return handleJsonResponse(response, next);
        }
    }).catch((err) => {
        if (!err) {
            err = "Unknown error.";
        }
        console.error("Error: " + err.message);
        // Removed changeDisplayedPage.callback calls
        throw err;
    });
}

function handleJsonResponse(response, next) {
    return response.json().then((myJson) => {
        return next(myJson);
    });
}

function handleImageResponse(response, next) {
    return response.blob().then((blob) => {
        const imageUrl = URL.createObjectURL(blob);
        return next(imageUrl);
    });
}

function handleStreamingResponse(response, next) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let error_in_next_call = false;
    function readChunk() {
        reader.read().then(({ value, done }) => {
            if (done) {
                next('', true, null);
                return;
            }
            const text = decoder.decode(value, { stream: true });
            try {
                next(JSON.parse(text), false, null);
            } catch (error) {
                error_in_next_call = true;
                throw error;
            }
            readChunk();
        }).catch(error => {
            if (!error_in_next_call) {
                // Removed changeDisplayedPage.callback calls
            }
            throw error;
        });
    }
    readChunk();
}

export function getSession(sessionId, next) {
    doRequest("GET", buildRestUri("get-session", sessionId), undefined, next);
}

export function getGetDataRepository(sessionId, next) {
    doRequest("GET", buildRestUri("get-data-repository", sessionId), undefined, next);
}

export function getPipeline(sessionId, pipelineId, callback) {
    doRequest("GET", buildRestUri("get-pipeline", sessionId + "/" + pipelineId), undefined, callback);
}

export function removeNode(sessionId, pipelineId, nodeId, callback) {
    doRequest("GET", buildRestUri("remove-node", sessionId + "/" + pipelineId + "/" + nodeId), undefined, callback);
}

export function runNode(sessionId, pipelineId, nodeId, callback) {
    doRequest("GET", buildRestUri("run-node", sessionId + "/" + pipelineId + "/" + nodeId), undefined, callback);
}

export function getPlot(sessionId, plotFileName, callback) {
    doRequest("GET", buildRestUri("get-plot", sessionId + "/" + plotFileName), undefined, callback);
}

export function updateTable(sessionId, tableName, newTable, callback) {
    doRequest("POST", buildRestUri("update-table", sessionId + "/" + tableName), newTable, callback);
}

export function runSqlQuery(sessionId, pipelineId, code, callback) {
    doRequest("POST", buildRestUri("run-sql-query", sessionId + "/" + pipelineId), code, callback);
}

export function updateNode(sessionId, pipelineId, node, callback) {
    doRequest("POST", buildRestUri("update-node", sessionId + "/" + pipelineId), node, callback);
}

export function createNode(sessionId, pipelineId, nodeType, newNode, callback) {
    doRequest("POST", buildRestUri("create-node", sessionId + "/" + pipelineId + "/" + nodeType), newNode, callback);
}

export function submitPrompt(sessionId, pipelineId, prompt, callback) {
    doRequest("POST", buildRestUri("submit-prompt", sessionId + "/" + pipelineId), prompt, callback);
} 