const background = chrome.extension.getBackgroundPage();
let dbPromise = null;
let currentPage = 1;
let pageData = null;

(function() {

    // TODO
    // Fix the date format in the table. it seems wrong.
    // console.log((new Date).getTime());
    // console.log(moment(1544544506507).format('ddd, Do MMM YYYY HH:mm'));

    dbPromise = idb.open('session-monitor-db', 1, upgradeDB => {
        upgradeDB.createObjectStore('session', { keyPath: ['id', 'domain'] });
        upgradeDB.createObjectStore('watchSession', { keyPath: ['id', 'domain'] });
    });

    dbPromise.then(db => {
        return db.transaction('session')
            .objectStore('session').getAll();
    }).then(
        allObjs => console.log(allObjs)
    );

    document.addEventListener("DOMContentLoaded", function() {
        openPage(1).then( data => {
            return updatePage(data);
        }).then( html => {
            // console.log(html);
            $('.table-data').append(html);
            return;
        }).then(() => {
            // $('.table-data-row.top-group-data').on('click', function(e){
            //     $('#'+$(this).attr('target')).toggleClass('hide');
            // })

            $('.date-sort > span, .domain-sort > span, .transfer-sort > span, .cache-sort > span, .total-sort > span').on('click', function(e){
                sort($(this).parent().attr('class'), $(this));
            })
        });
    });

    // Set an interval and call updatePage each seconds.
    // setInterval(function() {
    //     updatePage(false);
    // }, 1000);
}());

function openPage(page) {
    let start = (page * 50) - 50;
    let end = (page * 50000) - 1;

    let startDate = 0;

    return promise = new Promise(
        function (resolve, reject) {
            let data = [];
            dbPromise.then(db => {
                let i = 0;
                let tx = db.transaction('session');
                tx.objectStore('session')
                        .iterateCursor(null, 'prev', cursor => {
                            // Stop if cursor is empty or pass the end.
                            if (!cursor || i > end) {return;}

                            // Pass if cursor is before start
                            if(i >= start){

                                /**
                                 * Check if startdate of a data is different.
                                 * If it is different, means cursor is at a new
                                 * session. it will create a new data object.
                                 *  */
                                if(startDate !== cursor.value.id) {
                                    startDate = cursor.value.id;
                                    data.push({
                                        sDate: cursor.value.id,
                                        eDate: 0,
                                        cacheTotal: 0,
                                        transferredTotal: 0,
                                        data: []
                                    });
                                }
                                data[data.length-1].data.push(cursor.value);
                                data[data.length-1].cacheTotal += cursor.value.data.cachedTransferred;
                                data[data.length-1].transferredTotal += cursor.value.data.transferred;

                                if(data[data.length-1].eDate < cursor.value.data.update){
                                    data[data.length-1].eDate = cursor.value.data.update;
                                }
                            }
                            i ++;
                            cursor.continue();
                        });

                tx.complete.then(() => {
                    if(data) {
                        pageData = data;
                        resolve(data);
                    } else {
                        reject(new Error('page data is empty'));
                    }
                });
            });
        }
    );
}

function sortPage(type, dir){
    switch(type) {
        case 'date-sort':
            pageData.sort(function(a,b) {
                return (dir === 'asc') ? a.sDate - b.sDate : b.sDate - a.sDate;
            });
            break;
        case 'domain-sort':
            pageData.forEach( value => {
                value.data.sort(function(a,b) {

                    if (a.last_nom < b.last_nom) {
                        return -1;
                    } else if (a.last_nom > b.last_nom){
                        return 1;
                    } else {
                        return 0;
                    }
                });
            });
            break;
        case 'transfer-sort':
            pageData.sort(function(a,b) {
                return b.transferredTotal - a.transferredTotal;
            });
            break;
        case 'cache-sort':
            pageData.sort(function(a,b) {
                return b.cacheTotal - a.cacheTotal;
            });
            break;
        case 'total-sort':
            pageData.sort(function(a,b) {
                return (b.transferredTotal + b.cacheTotal) - (a.transferredTotal + a.cacheTotal);
            });
            break;

    }
}

function updatePage(datas){
    let id = 0;
    let html = '';

    datas.forEach( (sessions, i) => {
        let totalData = 0;
        let totalCached = 0;
        let totalTransferred = 0;

        let groupIndex = i + 1;
        // <a class="btn btn-primary" data-toggle="collapse" href="#collapseExample" role="button" aria-expanded="false" aria-controls="collapseExample">

        html += '<div class=\'table-data-row top-group-data\' data-toggle=\'collapse\' data-target=\'#group-' + groupIndex + '\' aria-control=\'group-' + groupIndex + '\' aria-expanded=\'false\'>';
        html += '<div>' + moment(sessions.sDate).format('dddd, Do MMM YYYY HH:mm') + '</div>';
        html += '<div>' + convertByteTable(sessions.transferredTotal) + '</div>';
        html += '<div>' + convertByteTable(sessions.cacheTotal) + '</div>';
        html += '<div>' + convertByteTable((sessions.transferredTotal + sessions.cacheTotal)) + '</div>';
        html += '</div>';
        html += '</div>';

        html += '<div id=\'group-' + groupIndex + '\' class=\'table-data-group collapse\'>';
        html += '<div class=\'table-break\'></div>'

        sessions.data.forEach( data => {
            html += '<div class=\'table-data-row\'>';

            html += '<div></div>'
            html += '<div>' + data.domain + '</div>';
            html += '<div>' + convertByteTable(data.data.transferred) + '</div>';
            html += '<div>' + convertByteTable(data.data.cachedTransferred) + '</div>';

            let total = data.data.transferred + data.data.cachedTransferred;
            html += '<div>' + convertByteTable(total) + '</div>';
            html += '</div>';

            totalData += total;
            totalCached += data.data.cachedTransferred;
            totalTransferred += data.data.transferred;
        });


        let dur = sessions.eDate - sessions.sDate;


        html += '<div class=\'table-data-row bottom-group-data\'>';
        html += '<div>Session length: ' + moment.duration(dur, 'milliseconds').format('h [hours] m [minutes]') + '</div>';
        html += '<div>' + convertByteTable(totalTransferred) + '</div>';
        html += '<div>' + convertByteTable(totalCached) + '</div>';
        html += '<div>' + convertByteTable(totalData) + '</div>';

        html += '</div>';
        html += '</div>';
        html += '<div class=\'table-break\'></div>'

    });


    return promise = new Promise(
        function (resolve, reject) {
            if(html.length !== 0){
                resolve(html);
            } else {
                reject(new Error('html is empty'));
            }
        }
    );


}




/**
 * updatePage is a function that will update the popup page. updatePage will
 * accept boolean to check if it's the first call or not.
 * @param first {Boolean}
 */
function updatePagex(first){
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

function convertByteTable(b){
    return ((Math.ceil((b/1000000)*1000))/1000).toFixed(3) + " MB"
    // return (b/1000000).toFixed(3) + " MB"
}
// return Math.round(b/1000000) + " MB"

function sort(type, button){
    let dir = '';
    $('.table-data > div:gt(1)').remove();

    if(button.hasClass('fa-sort-up')) {
        dir = 'desc';
        button.removeClass('fa-sort-up');
        button.addClass('fa-sort-down');
    } else if(button.hasClass('fa-sort-down')) {
        dir = 'asc';
        button.removeClass('fa-sort-down');
        button.addClass('fa-sort-up');
    } else {
        dir = 'asc';
        $('.table-header > div > span').removeClass('fa-sort fa-sort-up fa-sort-down');
        $('.table-header > div:not(' + type + ') > span').addClass('fa-sort');
        button.addClass('fa-sort-down');
    }

    sortPage(type, dir);

    updatePage(pageData).then(function(v){
        $('.table-data').append(v);
        console.log("success");
    });
}