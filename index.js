const background = chrome.extension.getBackgroundPage();


// TODO
// Find out how to use get with id

(function(){
    // TODO
    // this page should call update page every x interval so it will be
    // updated real time. but im not sure how.
    // updatePage(true);

    var dbPromise = idb.open('session-monitor-db', 1, upgradeDB => {
        upgradeDB.createObjectStore('session', { keyPath: ['id', 'domain'] });
        upgradeDB.createObjectStore('watchSession', { keyPath: ['id', 'domain'] });
    })

    dbPromise.then(db => {
        return db.transaction('session')
            .objectStore('session').get('1544091681810', 'www.youtube.com');
    }).then(
        allObjs => console.log(allObjs)
    );


    // Set an interval and call updatePage each seconds.
    // setInterval(function() {
    //     updatePage(false);
    // }, 1000);
}());


/**
 * updatePage is a function that will update the popup page. updatePage will
 * accept boolean to check if it's the first call or not.
 * @param first {Boolean}
 */
function updatePage(first){
    // Get pages from background.js and with boolean to check first or not call.
    var pages = background.GetPages(first);

    // Use hard-coded timer to reduce the amount of calls between popup and background.
    if(!first){
        timer += 1000;
    }

    // Set timer UI.
    $('#session-timer').text(moment.duration(timer, 'milliseconds').format('hh:mm:ss', {trim: false}));

    // Check if pages from background changed.
    if(pages) {
        updatePageTable(pages);
        updatePageChart(pages);
        chart.update();
    }
}