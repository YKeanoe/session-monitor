const background = chrome.extension.getBackgroundPage();
var ctx;
var chart;

let page = 'session'; // page is to determine current page, allow 'session'/'stopwatch'

var tab;

var timer;

var data = {
    type: 'doughnut',
    // The data for dataset. Start empty, populate on intervals.
    data: {
        labels: [],
        datasets: [{
            backgroundColor: [
                'rgb(255, 99, 132)',
                'rgb(255, 159, 64)',
                'rgb(255, 205, 86)',
                'rgb(75, 192, 192)',
                'rgb(54, 162, 235)',
                'rgb(153, 102, 255)'
            ],
            data: [],
        }]
    },
    options: {
        legend: {
            position: 'bottom',
            display: true,
            labels: {
                boxWidth: 15
            },
            onClick: null,
            onHover: function(event, activeElement){
                // TODO highlight on hover
                // var activeSegment = chart.getDatasetMeta(0).data[activeElement.index];
                // var activeSegment = chart.getDatasetMeta(0);
                // console.log(activeSegment);
                // chart.updateHoverStyle([activeSegment], null, true);
                // chart.draw();
            }
        },
        tooltips: {
            callbacks: {
                label: function(tooltipItem, chartData) {
                    return chartData.labels[tooltipItem.index] + ": " + chartData.datasets[0].data[tooltipItem.index] + "%";
                }
            }
        }
    }
};

// Wait untill popup page finish loading
document.addEventListener('DOMContentLoaded', function() {
    // Initialize canvas' context and chart
    ctx = document.getElementById('myChart').getContext('2d');
    chart = new Chart(ctx, data);
    page = background.getPopupPage();
    // Initialize timer
    timer = background.getSessionTimer();

    $('.stopwatch-toggle').on('click', function(){
        background.toggleStopwatch();
        updatePage(true);
    });

    $('.stopwatch-reset').on('click', function(){
        background.resetStopwatch();
        updatePage(true);
    });

    $('.btn-contact').on('click', function(){
        var win = window.open('https://thisisyohan.com');
        win.focus();
    });
    $('.btn-debugger').on('click', function(){
        // var win = window.open('chrome://flags');
        // win.focus();
        // chrome.tabs.update({ url: 'chrome://flags/' });
        // chrome.tabs.query({active: true}, function(tab) {
        //     // If selected tab is newtab, redirect tab. Else, open new tab.
        //     if(tab[0].url === 'chrome://newtab/') {
        //         chrome.tabs.update(tab[0].id, {url: 'index.html'}, function(){});
        //     } else {
                chrome.tabs.create({ url: "chrome://flags/#silent-debugger-extension-api"});

        // });
    });

    $('.btn-main-page').on('click', function(){
        background.openMainPage();
    });

    $('.btn-nav-session, .btn-nav-stopwatch').on('click', function(){
        let clicked = $(this).attr('class').split(' ')[0].split('-')[2];
        // console.log();
        if(page !== clicked){
            $('.btn-nav-session, .btn-nav-stopwatch').toggleClass('btn-nav-active');
            changePage(clicked);
        }

    });

    // Call updatePage the first time.
    updatePage(true);

    // Set an interval and call updatePage each seconds.
    setInterval(function() {
        updatePage(false);
    }, 500);
});

function changePage(type){
    // Do nothing if it's the same
    if(page === type) return;

    page = type;

    background.changePopupPage();

    if(type === 'session'){
        timer = background.getSessionTimer();
        updatePage(true);
    } else{
        if(background.areStopwatch()){
            timer = background.getStopwatchTimer();
            updatePage(true);
        } else {
            timer = 0;
            updatePage(true);
        }
    }
}


/**
 * updatePage is a function that will update the popup page. updatePage will
 * accept boolean to check if it's the first call or not.
 * @param first {Boolean}
 */
function updatePage(first){
    /**
     * Get either session or stopwatch pages from background.js and
     * with boolean to check first or not call.
     **/
    let datas = (page === 'session') ? background.getPages(first) : background.getStopwatchPages(first);

    if(first){
        if(page === 'session'){
            timer = background.getSessionTimer();
            if(!$('.btn-nav-session').hasClass('btn-nav-active')){
                $('.btn-nav-session').toggleClass('btn-nav-active');
            }
            $('.stopwatch-toggle').addClass('hide');
            $('.stopwatch-reset').addClass('hide');
            $('.timer-title').text('Session Timer')
        } else {
            timer = background.getStopwatchTimer();
            if(!$('.btn-nav-stopwatch').hasClass('btn-nav-active')){
                $('.btn-nav-stopwatch').toggleClass('btn-nav-active');
            }
            $('.stopwatch-toggle').removeClass('hide');
            $('.stopwatch-reset').removeClass('hide');
            let btnText = background.areStopwatch() ? 'Stop' : 'Start';
            $('.stopwatch-toggle').text(btnText);
            $('.timer-title').text('Stopwatch Timer')
        }
    } else {
        if(page === 'session'){
            timer = background.getSessionTimer();
        } else {
            timer = background.getStopwatchTimer();
        }
    }


    // Set timer UI.
    console.log(timer);
    if(timer === 0){
        $('#session-timer').text(moment.duration(0, 'milliseconds').format('hh:mm:ss', {trim: false}));
    } else {
        $('#session-timer').text(moment.duration(timer, 'milliseconds').format('hh:mm:ss', {trim: false}));
    }

    // Check if pages from background changed.
    if(datas) {
        updatePageTable(datas);
        updatePageChart(datas);
        chart.update();
    }
}

/**
 * updatePageChart is a function that will update the popup page's doughtnut chart.
 * @param pages {Pages Object}
 */
function updatePageChart(pages){
    // Sort the pages object by total size descending.
    pages.sort((a,b) => {
        return (b.transferred + b.cachedTransferred) - (a.transferred + a.cachedTransferred);
    });

    // Get the total data transferred.
    var totalData = getTotal(pages, 'total');

    // Initialize temporary data, label, and etc data
    var tempData = [];
    var tempLabel = [];
    var otherData = 0;

    // Iterate through pages object to get the 5 biggest page usage and other datas.
    $.each(pages, function( i, v ) {
        var pageData = v.transferred + v.cachedTransferred;

        if(i < 5) {
            tempLabel.push(v.domain);
            tempData.push(convertToPercent(totalData, pageData));
        } else {
            otherData += v.transferred + v.cachedTransferred;
        }
    });

    // If there are more than 5 pages, then add other label
    if(pages.length > 5) {
        tempData.push(convertToPercent(totalData, otherData));
        tempLabel.push('Other');
    }

    // Add the label and data to chart
    data.data.labels = tempLabel;
    data.data.datasets[0].data = tempData;
}

function highlightSegment(index, isHighlight) {
    var activeSegment = chart.getDatasetMeta(0).data[index];
    if (isHighlight) chart.updateHoverStyle([activeSegment], null, true);
    else chart.updateHoverStyle([activeSegment], null, false);
    chart.draw();
 }

function convertToPercent(total, v){
    return Math.round((v/total) * 100);
}

function updatePageTable(pages) {
    $( "#session-table > tbody > tr.tr-data" ).remove();

    pages.sort((a,b) => {
        return b.update - a.update;
    });

    var otherDataTransferred = 0;
    var otherDataCache = 0;
    var row = '';
    $.each(pages, function(i,v){
        if(i < 5){
            row = "<tr class=\"tr-data\">"
                + "<td>"
                + v.domain
                + "</td>"
                + "<td>"
                + convertByteTable(v.transferred)
                + "</td>"
                + "<td>"
                + convertByteTable(v.cachedTransferred)
                + "</td>"
                + "</tr>";
            $( "#session-table > tbody" ).append( row );
        } else {
            otherDataTransferred += v.transferred;
            otherDataCache += v.cachedTransferred;
        }
    });

    if(pages.length > 5) {
        row = "<tr class=\"tr-data\">"
                + "<td>Other</td>"
                + "<td>"
                    + convertByteTable(otherDataTransferred)
                + "</td>"
                + "<td>"
                    + convertByteTable(otherDataCache)
                + "</td>"
            + "</tr>";
        $( "#session-table > tbody" ).append( row );
    }



    row = "<tr class=\"tr-data\">"
            + "<td>Total</td>"
            + "<td>"
                + convertByteTable(getTotal(pages, 'transferred'))
            + "</td>"
            + "<td>"
                + convertByteTable(getTotal(pages, 'cached'))
            + "</td>"
        + "</tr>";
    $( "#session-table > tbody" ).append( row );
}


function convertByteTotal(d, t){
    var b = 0;

    $.each( d, function( k, v ) {
        switch(t){
            case 1:
                b += v.size;
                break;
            case 2:
                b += (v.size-v.cache);
                break;
            case 3:
                b += v.cache;
                break;
            default:
                break;
        }
    });

    return (b/1000000).toFixed(2) + " MB"

}

function convertByteTable(b){
    return (b/1000000).toFixed(2) + " MB"
}


function convertTimer(t){
    var dur = moment.duration(timer, "ms");

    var string = '';

    var d = dur.days();
    var h = dur.hours();
    var m = dur.minutes();
    var s = dur.seconds();

    if((dur.days() > 0 )){
        string += dur.days() + ":";
    }
    if(dur.hours() > 0 ){
        string += (dur.hours() > 9) ? dur.hours() + ':' : '0' + dur.hours() + ':';
    }
    if(dur.hours() > 0 ){
        string += (dur.hours() > 9) ? dur.hours() + ':' : '0' + dur.hours() + ':';
    }
    if(dur.hours() > 0 ){
        string += (dur.hours() > 9) ? dur.hours() + ':' : '0' + dur.hours() + ':';
    }

    return string;
}

function convertFiles(d){
    var html = "";

    html += "<tr>";
    html += "<th>Page</th>";
    html += "<th>Transferred</th>";
    html += "<th>Cached</th>";
    html += "</tr>";

    console.log(d);
    d.forEach(element => {
        html += "<tr>";
        html += "<td>" + element.domain + "</td>";
        html += "<td>" + convertByteTable(element.transferred) + "</td>";
        html += "<td>" + convertByteTable(element.cachedTransferred) + "</td>";
        html += "</tr>";
    });
    return html;
}

function getTotal(pages, type) {
    var totalData = 0;
    $.each(pages, function( i, v ) {
        switch(type){
            case 'cached':
                totalData += v.cachedTransferred;
                break;
            case 'transferred':
                totalData += v.transferred;
                break;
            case 'total':
                totalData += v.transferred + v.cachedTransferred;
                break;
            default:
                break;
        }
    });
    return totalData;
}