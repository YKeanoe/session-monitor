/** ======================= Declaring Variables ============================= */

/**
 * sessionMonitor is a namespace that will store all global variables
 * needed in order to not pollute the global scope.
 */
let sessionMonitor = {
    /**
     * pages is an array of object that stores the domain name and the amount of
     * data transferred for this domain.
     * schema example : {
     * domain: 'www.youtube.com',
     * transferred: 0,
     * cachedTransferred: 0,
     * update: 1541582906,
     * timer: 0
     * }
     */
    pages: [],
    /**
     * stopwatchPages is just like pages but for stopwatch. The pages for
     * session and stopwatch are separated.
     */
    stopwatchPages: [],
    /**
     * items is an array of object that stores the request's domain name and the amount of
     * data transferred for it.
     * schame example: {
     * page: 'www.youtube.com', // domain url
     * request: 'www.youtube.com/watch?12asd1', // request url
     * requestId: '1019331.10', // request id
     * cache: false, // transferred through cache or not
     * dataLength: 1024, // total data transferred
     * updated: 1087218312 // last updated
     * }
     */
    items: [],
    /**
     * changes is a boolean that will switch to true if storeItem function is called.
     * Used so that it will return false to popup if there are no changes made to the
     * pages.
     */
    changes: false,
    /**
     * stopwatch is an integer used to store how much time has passed since
     * the stopwatch has started.
     */
    stopwatch: 0,
    /**
     * isStopwatch is a boolean used to tell if the stopwatch is running
     */
    isStopwatch: false,
    /**
     * dbPromise is an indexedDB promise object.
     */
    dbPromise: null,
    /**
     * id is a unique ID for each session. id will be created using unix ms.
     */
    id: 0
}

/**
 * ignoredMessage is used to filter unused message. It's likely better to just
 * filter usedMessage instead but I'm not sure which message should be included.
 */
const ignoredMessage = [
    'Network.resourceChangedPriority',
    'Network.eventSourceMessageReceived',
    'Network.webSocketWillSendHandshakeRequest',
    'Network.webSocketHandshakeResponseReceived',
    'Network.webSocketFrameSent',
    'Network.webSocketFrameReceived',
    'Network.webSocketCreated',
    'Network.webSocketClosed'
];

/** ============================== Logic ==================================== */

/**
 * On start logic. The session monitor will open the indexedDB for use. It will
 * the make a new ID using unixtime and it will attach all debugger to all tabs.
 */
(function(){
    sessionMonitor.dbPromise = idb.open('session-monitor-db', 1, upgradeDB => {
        upgradeDB.createObjectStore('session', { keyPath: ['id', 'domain'] });
        upgradeDB.createObjectStore('stopwatch', { keyPath: ['id', 'domain'] });
    });

    // sessionMonitor.dbPromise.then(db => {
    //     return db.transaction('stopwatch')
    //         .objectStore('stopwatch').getAll();
    // }).then(
    //     allObjs => console.log(allObjs)
    // );
    // idb.delete('session-monitor-db');

    console.log("Start session monitor");
    sessionMonitor.id = (new Date).getTime();
    attachAllDebugger();
}());

/**
 * Listen to tab update and attach it to a debugger when updated. it will check
 * if the url of the tab is updated and check & attach a debugger to it.
 * OnUpdate will also check for old unstored items and remove them if it has been
 * 5 minute old.
 * @param {String} tabId
 * @param {Object} changeInfo
 * @param {Tab Object} tab
 */
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
    if(changeInfo.url) checkAndAttachDebugger(tab);

    if(sessionMonitor.items.length > 0){
        sessionMonitor.items.forEach((item, i, items) => {
            if((new Date).getTime() - item.updated >= 300000) {
                items.splice(i, 1);
            }
        });
    }
});

/** ===================== Background.js Functions =========================== */

/**
 * Called to attach all tabs with a debugger. The function will query all
 * chrome's tabs and check & attach debugger to each tabs. It will then add
 * onEvent listener to the debugger.
 */
function attachAllDebugger(){
    chrome.tabs.query({}, function(tabs){
        $.each(tabs, function(i, v){
            checkAndAttachDebugger(v);
        });
    });
    chrome.debugger.onEvent.addListener(onEvent);
}

/**
 * listDebugger is a function to list all available debugger targets.
 */
function listDebugger(){
    chrome.debugger.getTargets(function(res){
        console.log(res);
    });
}

/**
 * isNormalUrl is a function to check if the url of a tab is normal url or
 * chrome's url.
 * @param {Tab Object} tab
 * @return {Boolean}
 */
function isNormalUrl(tab) {
    var chromeURL = new RegExp('^((chrome|chrome-extension):\/\/.*[\/]*)$');
    if(chromeURL.test(tab.url)) {
        return false;
    } else {
        return true;
    }
}

/**
 * checkAndAttachDebugger is a function that will check if the tab is a normal
 * url or already attached to a debugger. It will then call AttachDebugger if
 * there is no problem.
 * @param {Tab Object} tab
 */
function checkAndAttachDebugger(tab) {
    if(!isNormalUrl(tab)) return;

    chrome.debugger.getTargets(function(res){
        var targetTab = res.find(function(val){
            return val.tabId == tab.id;
        });

        if(targetTab.attached){
            console.log("Tab " + tab.title + " already has a debugger");
        } else {
            AttachDebugger(tab);
        }
    });
}

/**
 * Attach a debugger to a tab and enable network tracking. When AttachDebugger
 * is called, the function will also add page object to the pages array.
 * @param {Tab Object} tab
 */
function AttachDebugger(tab) {
    chrome.debugger.attach({tabId: tab.id}, "1.0", onAttach.bind(null, tab.id));
    console.log("Debugger attached to tab " + tab.title);
    chrome.debugger.sendCommand({tabId:tab.id}, "Network.enable");
}

/**
 * Function called after attaching debugger.
 * Just logging error.
 * @param {int} tabId
 */
function onAttach(tabId){
    if(chrome.runtime.lastError){
        console.error(chrome.runtime.lastError.message);
        return;
    }
}

/**
 * Debugger OnEvent function.
 * @param {String} debugeeId
 * @param {String} msg
 * @param {Object} param
 */
function onEvent(debugeeId, msg, param) {
    // Ignore if it is debugger being detached or any other unused messages.
    if(msg == 'Inspector.detached' || ignoredMessage.includes(msg)) {
        return;
    }

    if(msg == 'Network.requestWillBeSent') {

        // At the start of a request, make a new item and add it to items array.
        let newItem = {
            page: extractHostname(param.documentURL), // page url
            request: param.request.url,
            requestId: param.requestId, // request id to identify request
            cache: false, // if the transfer is from cache
            dataLength: 0, // dataLength identify data length
            updated: (new Date).getTime()
        };

        sessionMonitor.items.push(newItem);
        return;

    } else {

        // Ignore requestServedFromCache event
        if(msg == 'Network.requestServedFromCache') return;

        // Call getItem as promise so that received item is defined
        getItem(debugeeId, param.requestId)
            .then((item) => {
                item.updated = (new Date).getTime();

                switch(msg) {
                    case "Network.responseReceived":
                        item.cache = param.response.fromDiskCache;
                        break;

                    case "Network.dataReceived":
                        // If data is encoded, use encodedDataLength
                        if(param.encodedDataLength){
                            item.dataLength += param.encodedDataLength;
                        } else {
                            item.dataLength += param.dataLength;
                        }
                        break;

                    case "Network.loadingFailed":
                        // Failed https are counted as the transfer is still done.
                        console.warn("Loading failed ID " + item.requestId + "\n"
                            + "Reason: " + param.errorText);

                    case "Network.loadingFinished":
                        /**
                         * Check if data length calculated is zero yet loading
                         * finished parameter shows otherwise. Not sure why this
                         * happen.
                         * */
                        if(item.dataLength === 0 && param.encodedDataLength > 0){
                            item.dataLength += param.encodedDataLength;
                        }

                        // Clear item when its done
                        sessionMonitor.items = sessionMonitor.items.filter(function( obj ) {
                            return obj.requestId !== item.requestId;
                        });

                        // Store item to pages
                        storeItem(item);

                        break;

                    default:
                        // Debug to tell if there are missed events.
                        console.log(msg);
                        console.log(param);
                        break;
                }
            }
        );
    }
}

/**
 * storeItem is a function thats called when a request is finished.
 * @param {item Object} item
 */
function storeItem(item) {
    // Ignore empty network request
    if(item.dataLength === 0) return;

    // boolean variable to determine db update
    let updateSession = updatePage('session', item);
    let updateStopwatch = (sessionMonitor.isStopwatch) ? updatePage('stopwatch', item) : false;

    // Set changes to true to tell new data is added
    if(updateSession || updateStopwatch) sessionMonitor.changes = true;

    // Update indexedDB if update boolean is true.
    if(updateSession) updateSessionStorage(targetPage);
    if(updateStopwatch) updateStopwatchStorage(targetPage)
}

/**
 * updatePage will update the page object of either session or stopwatch items.
 * The function will then return boolean if the page object has been updated.
 * @param {String} type
 * @param {Item Object} item
 * @returns {Boolean}
 */
function updatePage(type, item){
    // Set the pages array to either session or stopwatch pages
    let pages = (type === 'session') ? sessionMonitor.pages : sessionMonitor.stopwatchPages;
    let update = false;

    // Find target page from pages array
    targetPage = pages.find(function(e){
        return e.domain === item.page;
    });

    // If targetPage is found, apply calculation to targetPage object.
    if(targetPage) {
        // Check if the data is a cache
        if(item.cache) {
            targetPage.cachedTransferred += item.dataLength;
        } else {
            targetPage.transferred += item.dataLength;
        }

        // Check if page last update is more than a seconds ago
        if((new Date).getTime() - targetPage.update >= 1000){
            update = true;
        }

        // Update the update timer
        targetPage.update = (new Date).getTime();
    }
    // If targetPage is not found, create a new page object to be calculated.
    else {
        // Send an error to console.
        if(item.page === '') {console.error("Page item domain is empty.", item);}

        let newPage = {
            domain: item.page,
            transferred: (item.cache) ? 0 : item.dataLength,
            cachedTransferred: (item.cache) ? item.dataLength : 0,
            update: (new Date).getTime(),
            timer: 0
        }

        update = true;
        targetPage = newPage;
        pages.push(newPage);
    }

    return update;
}



/**
 * getItem is an async function to retrieve the item. If the item is in items
 * stack, just retrieve it. If the item is not in items stack, then use
 * chrome.tabs to find the tab's url. Due to the use of chrome.tabs.get
 * function, promise is required so that the item will have the page name
 * before continuing.
 * @param debugeeId {String}
 * @param requestId {String}
 */
async function getItem(debugeeId, requestId){
    // Find item
    item = sessionMonitor.items.find(function(e){
        return e.requestId == requestId;
    });

    // if item not found, make a new item
    if(!item){
        item = {
            page: '', // page url
            request: '',
            requestId: requestId, // request id to identify request
            cache: false, // if the transfer is from cache
            dataLength: 0, // dataLength identify data length
            updated: (new Date).getTime()
        };
        return await defineItem(item, debugeeId);
    } else{
        return item;
    }
}

/**
 * defineItem is an async function to set the item page name.
 * @param item {Item Object}
 * @param debugeeId {debugeeId Object} // contain tab ID
 */
function defineItem(item, debugeeId){
    return new Promise(resolve => {
        chrome.tabs.get(debugeeId.tabId, function(tab){
            item.page = extractHostname(tab.url);
            sessionMonitor.items.push(item);
            resolve(item);
        });
    });
}

/**
 * updateSessionStorage is a function that will save the pages data into
 * indexedDB.
 * @param page {Page Object}
 */
function updateSessionStorage(page){
    sessionMonitor.dbPromise.then(db => {
        const tx = db.transaction('session', 'readwrite');
        tx.objectStore('session').put({
            id: sessionMonitor.id,
            domain: page.domain,
            data: {
                transferred: page.transferred,
                cachedTransferred: page.cachedTransferred,
                update: (new Date).getTime()
            }
        });
        return tx.complete;
    });
}

/**
 * updateStopwatchStorage is a function that will save the pages data into
 * indexedDB.
 * @param page {Page Object}
 */
function updateStopwatchStorage(page){
    sessionMonitor.dbPromise.then(db => {
        const tx = db.transaction('stopwatch', 'readwrite');
        tx.objectStore('stopwatch').put({
            id: sessionMonitor.stopwatch,
            domain: page.domain,
            data: {
                transferred: page.transferred,
                cachedTransferred: page.cachedTransferred,
                update: (new Date).getTime()
            }
        });
        return tx.complete;
    });
}

/**
 * extractHostname is a function that will extract url into domain name.
 * @param {String} url
 */
function extractHostname(url) {
    var hostname;
    //find & remove protocol (http, ftp, etc.) and get hostname
    if (url.indexOf("//") > -1) {
        hostname = url.split('/')[2];
    } else {
        hostname = url.split('/')[0];
    }

    //find & remove port number
    hostname = hostname.split(':')[0];
    //find & remove "?"
    hostname = hostname.split('?')[0];

    return hostname;
}

/**
 * openMainPage is a function that will open the index.html in a new tab or
 * in the current tab if the current tab is a newtab page.
 */
function openMainPage(){
    chrome.tabs.query(
        {
            url: 'chrome-extension://ghlogoapdidadhneeomhknldlgooaooi/index.html'
        },
        function(tab) {
            if(tab.length !== 0) {
                chrome.tabs.update(tab[0].id, {active:true}, function(){});
            }
            else {
                chrome.tabs.query({active: true}, function(tab) {
                    // If selected tab is newtab, redirect tab. Else, open new tab.
                    if(tab[0].url === 'chrome://newtab/') {
                        chrome.tabs.update(tab[0].id, {url: 'index.html'}, function(){});
                    } else {
                        chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
                    }
                });
            }
        }
    );
}



/** ================= Getter and Setter for external script ================= */


/**
 * getPages is a function that will return the session pages object.
 * First is a boolean variable to tell if it is the first call made.
 * getPages will then check if there's any changes made between the current call
 * and last call.
 * @param {Boolean} first
 */
function getPages(first){
    if(first) return sessionMonitor.pages;

    if(sessionMonitor.changes){
        sessionMonitor.changes = false;
        return sessionMonitor.pages;
    } else {
        return null
    }
}

/**
 * getTimer is a function that will return the session timer.
 */
function getSessionTimer(){
    return (new Date).getTime() - sessionMonitor.id;
}

/**
 * getStopwatchTimer is a function that will return the stopwatch timer.
 */
function getStopwatchTimer(){
    return (new Date).getTime() - sessionMonitor.stopwatch;
}

/**
 * toggleStopwatch is a function that will toggle the stopwatch on and off.
 */
function toggleStopwatch(){
    sessionMonitor.isStopwatch = !sessionMonitor.isStopwatch;
    sessionMonitor.stopwatch = (sessionMonitor.isStopwatch) ? (new Date).getTime() : 0;
}

/**
 * areStopwatch is a getter for isStopwatch.
 */
function areStopwatch(){
    return sessionMonitor.isStopwatch;
}

/**
 * restartSession is a function to reset the session.
 */
function restartSession(){
    sessionMonitor.id = (new Date).getTime();
    sessionMonitor.pages = [];
    sessionMonitor.items = [];
}

// Debug command
function printpage(){
    console.log("aaaaa");
    console.log(sessionMonitor);
}
// function isChanged(){
//     return
// }