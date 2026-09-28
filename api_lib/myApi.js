// Kopiér og videreudvikl funktionerne fra dit personlige API her.
// Dine genbrugelige API-funktioner kommer her.

//const { createElement } = require("react")

function showToast(toastDiv="#toast", txt, timeout=2000, type="notify"){
    try{
        toast = select(toastDiv)
    }catch(error){
        console.log("could not get element id:", toast)
        return
    }
    if (toast) {
        toast.html(txt)
        toast.addClass('toastShow')
        toast.addClass(type)
        setTimeout(()=>{
            toast.removeClass('toastShow')
        }, timeout)
    }
}

//--shiftPage---------------------------------------------------
/*
function shiftPage(newPage, currentPage){
    select(currentPage).removeClass('show')
    select(newPage).addClass('show')
    currentPage = newPage
}
*/
var currentPage
function shiftPage(newPage, currentPage = currentPage){
    select(currentPage).removeClass('show')
    select(newPage).addClass('show')
    currentPage = newPage
}

//--Timer ---------------------------------------------------

var timerInterval      = null

function startTimer(id, long) {
    ele = document.getElementById(id);
    // Clear any existing timer first
    if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
    }
    seconds = 1;
    timerInterval = setInterval(function () {
        ele.innerHTML = seconds;
        console.log('Timer tick:', seconds,'seconds')
        seconds += 1

        stopTimer = select("stopTimer")
        if(seconds > long){
            console.log("stop", seconds)
            clearInterval(timerInterval)
            timerInterval = null
            return seconds -1
        }
        
    }, 1000)
}

//--show text on div or h or whatever-----------

// global variables for type writer effect
var i = 0; // character counter
var txt = ''; // text to display
var speed = 100; // wait time between letters
var field; // element to write to

function typeWriter() {
  if (i < txt.length) {
    field.innerHTML += txt.charAt(i); // add next character
    i++; // increment counter
    setTimeout(typeWriter, speed); // wait and then repeat
  }
}

function setText(id, tx){
    deleteText(id); // make sure element is empty
    i = 0; // make sure i is 0
    txt = String(tx); // set txt as tx 
    field = document.getElementById(id); // set element to write to
    typeWriter(); // run typewriter
}

function deleteText(id){
    document.getElementById(id).innerHTML = "";
}



function createMenu(menuDivId){
    var allPages = selectAll(".page")
    allPages.map( p => {
        var a = createElement('a')
        if(p.attribute('title')){
            a.html( p.attribute('title'))
        }else{
            a.html( p.attribute(id))
        }
    })
}

async function getJSON( endpoint ){
    //vi starte med at kontakter serveren med et request
    var res
    try{
        res = await fetch(endpoint)
    }catch(error){
        console.log(error)
    }
    //hvis response er ok, henter vi json data
    var json = await res.json()
    console.log(`hentede ${json.length} poster fra fetchJSON`, json)
    return json
}

function createCard(t = "", txt = "", i = "") {
    var card = createDiv().addClass('card')
    var i = createImg(i)
    card.child(i)
    var t = createElement("h2", t)
    card.child(t)
    var txt = createElement("p", txt)
    card.child(txt)
    return card
    
}