// TODO removing unused items and making ui
// some items are not removed
// maybe because load failed? or maybe the splice function is faulty?

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
     * items is an array of object that stores the request's domain name and the amount of
     * data transferred for it.
     * schame example: {
     * page: 'www.youtube.com', // domain url
     * request: 'www.youtube.com/watch?12asd1', // request url
     * requestId: '1019331.10', // request id
     * cache: false, // transferred through cache or not
     * dataLength: 1024 // total data transferred
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
     * timer is an integer used to store how much time has passed since the
     * monitor started.
     */
    timer: 0,
    /**
     * stopwatch is an integer used to store how much time has passed since
     * the stopwatch has started.
     */
    stopwatch: 0
}

// var pages = [];
// var items = [];
// var changes = false;

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

// var timer;

/** ============================== Logic ==================================== */


(function(){

    // var dbPromise = idb.open('test-db1', 1, upgradeDB => {
    //     upgradeDB.createObjectStore('objs', { autoIncrement: true })
    // }).then(db => {
    //     console.log("DB!", db);
    //     const tx = db.transaction('objs', 'readwrite');
    //     tx.objectStore('objs').put({
    //         id: 123456,
    //         data: {foo: "bar"}
    //     });
    //     return tx.complete;
    // });

    // TODO FIGURE OUT INDEXEDDB

    var dbPromise = idb.open('test-db1', 1, upgradeDB => {
        upgradeDB.createObjectStore('objs', { autoIncrement: true })
    }).then(db => {
        console.log("DB!", db);
        const tx = db.transaction('objs', 'readwrite');
        tx.objectStore('objs').put({
            id: 123456,
            data: {foo: "bar"}
        });
        return tx.complete;
    });

    var dbPromise = idb.open('test-db1', 1, upgradeDB => {
        upgradeDB.createObjectStore('objs', { autoIncrement: true })
    }).then(db => {
        return db.transaction('objs')
            .objectStore('objs').getAll();
    }).then(
        allObjs => console.log(allObjs)
    );



    // idb.delete('test-db1');

    console.log("Start session monitor");
    sessionMonitor.timer = (new Date).getTime();
    attachAllDebugger();
    checkAndSetStorage();
}());



/**
 * Listen to tab update and attach it to a debugger when updated. it will check
 * if the url of the tab is updated and check & attach a debugger to it.
 * @param tabId {String}
 * @param changeInfo {Object}
 * @param tab {Tab Object}
 */
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
    if(changeInfo.url) {
        checkAndAttachDebugger(tab);
    }
});

chrome.windows.onRemoved.addListener(function() {
    console.log('window removed');
    // checkAndSaveStorage();
})


chrome.webRequest.onHeadersReceived.addListener(function(details) {
},
{urls: ["<all_urls>"]},
["blocking"]);

chrome.webRequest.onBeforeRequest.addListener(function(details) {
},
{urls: ["<all_urls>"]},
["blocking"]);

chrome.webRequest.onResponseStarted.addListener(function(details) {
},
{urls: ["<all_urls>"]},
["responseHeaders"]);
// =======


/** ===================== Background.js Functions =========================== */

/**
 * Some network transfer might be lost due to debugger attached after network
 * request.
 */

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
 * @param tab {Tab Object}
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
 * @param tab {Tab Object}
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
 * @param tab {Tab Object}
 */
function AttachDebugger(tab) {
    chrome.debugger.attach({tabId: tab.id}, "1.0", onAttach.bind(null, tab.id));
    console.log("Debugger attached to tab " + tab.title);
    chrome.debugger.sendCommand({tabId:tab.id}, "Network.enable");
}

/**
 * Function called after attaching debugger.
 * Just logging error.
 * @param int tabId
 */
function onAttach(tabId){
    if(chrome.runtime.lastError){
        console.error("WOA!");
        console.error(chrome.runtime.lastError.message);
        return;
    }
}

/**
 * Debugger OnEvent function.
 * @param debugeeId {String}
 * @param msg {String}
 * @param param {Object}
 */
function onEvent(debugeeId, msg, param) {
    if(msg == 'Inspector.detached') {
        // TODO check if a page is closed and set timer to stop.
        return;
    }

    if(ignoredMessage.includes(msg)){
        // Ignoring unused message.
        return;
    }

    let item;

    if(msg == 'Network.requestWillBeSent') {
        // At the start of a request, make a new item and add it to items array.
        let newItem = {
            page: extractHostname(param.documentURL), // page url
            request: param.request.url,
            requestId: param.requestId, // request id to identify request
            cache: false, // if the transfer is from cache
            dataLength: 0 // dataLength identify data length
        };
        sessionMonitor.items.push(newItem);
        return;
    } else {
        // Ignore requestServedFromCache event
        if(msg == 'Network.requestServedFromCache') return;

        // Call getItem as promise so that received item is defined
        getItem(debugeeId, param.requestId).then(
            (item) => {
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
 * @param item {item Object}
 */
function storeItem(item) {
    // Ignore empty network request
    if(item.dataLength === 0) return;

    targetPage = sessionMonitor.pages.find(function(e){
        return e.domain === item.page;
    });

    if(targetPage) {
        if(item.cache) {
            targetPage.cachedTransferred += item.dataLength;
        } else {
            targetPage.transferred += item.dataLength;
        }
        targetPage.update = (new Date).getTime();
    } else {
        // console.warn("Page not found for " + item.page);
        if(item.page === '') {
            console.error("Page item is empty?!?!");
            console.log(item);
            console.log(item.page);
        }
        // console.log("Push new page " + item.page);
        let newPage = {
            domain: item.page,
            transferred: (item.cache) ? 0 : item.dataLength,
            cachedTransferred: (item.cache) ? item.dataLength : 0,
            update: (new Date).getTime(),
            timer: 0
        }
        sessionMonitor.pages.push(newPage);
    }
    // Set changes to true so that popup will update the data.
    sessionMonitor.changes = true;

    // console.log('%c Item ID ' + item.requestId + ' stored.', 'color: green;');
    // console.log(pages);
    // console.log(items);
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
        console.warn("Item not found request " + requestId);
        item = {
            page: '', // page url
            request: '',
            requestId: requestId, // request id to identify request
            cache: false, // if the transfer is from cache
            dataLength: 0 // dataLength identify data length
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

function checkAndSetStorage(){
    // chrome.storage.local.clear(function(x){console.log(x)});
    chrome.storage.local.get('pages', function(storedPages){
        if(storedPages.pages){
            console.log("not empty");
            sessionMonitor.pages = storedPages.pages;
        } else{
            console.log(" empty");
            sessionMonitor.pages = [];
        }
    })
}

function saveSessionStorage(id){
    console.log('Save new storing session');

    chrome.storage.local.get('session', function(sessions){
        var sessions = (sessions.session) ? sessions.session : [];

        var session = {
            id: id,
            duration: 0
        }

        sessions.unshift(session);

        chrome.storage.local.set({ 'session' : sessions }, function(){
            console.log("pages stored");
        });

    });
}

function updateSessionStorage(id){
    console.log('Start storing session');

    chrome.storage.local.get('session', function(sessions){
        // Check empty storage ?! should not happen
        if(!sessions.session){
            console.error('Storage not found!!');
            return;
        }
        // TODO TRY UPDATING EVERY STORE PAGE
        var target = sessions.session.find(function(val){
            return val.id == id;
        });

        console.log(target);

        target.duration = (new Date).getTime() - id;
        //target.pages =

        chrome.storage.local.set({ 'session' : sessions }, function(){
            console.log("pages stored");
        });

    });
}

function printSessionStorage(){
    chrome.storage.local.get('session', function(storedPages){
        console.log(storedPages);
    });
}

function clearSessionStorage(){
    chrome.storage.local.clear(function(x){console.log(x)});
}

function savePages(){
    console.log('storing pages');
    chrome.storage.local.set({ "pages": sessionMonitor.pages }, function(){
        console.log("pages stored");
    });
}

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

function GetTotal() {
    return total;
}

/**
 * GetPages is called from popup.js to get the pages object.
 * first is a boolean that's true if its the first call from popup.js.
 * GetPages will then check if there's any changes made between the call
 * and last called.
 * @param first {Boolean}
 */
function GetPages(first){
    if(first) return sessionMonitor.pages;

    if(sessionMonitor.changes){
        sessionMonitor.changes = false;
        return sessionMonitor.pages;
    } else {
        return null
    }
}

function GetTimer(){
    return (new Date).getTime() - sessionMonitor.timer;
    // return timer;
}

function savuu(){
    // return "savuuuu";
    // savePages();
    saveSessionStorage((new Date).getTime());
}

function printuu(){
    printSessionStorage();
}

function clearuu(){
    clearSessionStorage();
}