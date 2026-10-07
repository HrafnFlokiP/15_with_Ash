// Dine genbrugelige API-funktioner kommer her.


//toastDiv: Demands an HTML element with id="toast", or send a custom ID name  
//txt : the text the toast will display
//timeout: how long the toast will show in ms, defaults to 2000
//type: choose between notify and warning 
function showToast(txt, timeout=2000, type="notify"){
    var toast  
    try {
        toast = select('#toast')
    }catch(err){
        console.log('Couldnt select element with id: ' , toastDiv, err)
        return
    }

    toast.html(txt)
    toast.addClass(type)
    toast.addClass('toastShow')
    setTimeout(()=>{
        toast.removeClass(type)
        toast.removeClass('toastShow')
    }, timeout)
}


//Kaldes med newPageId - og toggler klassen show på den side som har det nye id 
var currentPage
function shiftPage(newPageId){
    if(select(currentPage)) select(currentPage).removeClass('show')
    select(newPageId).addClass('show')
    currentPage = newPageId
}

//Tager alle div'er med klassen .page 
//Der SKAL være div'er med klassen .page 
//De SKAL have et selvstændigt id 
//For hver af dem opretter den et link med mousePressed til den pågældende side  
//Og så sætter den de links ind i menuDivId
//menuDivId: CSS-selektor til menuen, fx '.sidebar'
//onShift: valgfri funktion i stedet for shiftPage — fx setCanvasShiftPage
function createMenu(menuDivId, onShift){
    onShift = onShift || shiftPage
    var allPages = selectAll('.page')
    allPages.map( p => {
        var a = createElement('a')
        if(p.attribute('title')){
            a.html( p.attribute('title') )
        }else{
            a.html( p.attribute('id') )
        }
        a.mousePressed( ()=>{ onShift('#' + p.attribute('id'))} )
        select(menuDivId).child(a)
    } )
}

//Funktion der henter og returnerer JSON fra et API
async function getJSON( endpoint ){
    //Vi starter med at kontakte serveren med et request
    var res 
    try{
        res = await fetch( endpoint )
    }catch(err){
        console.log(err)
    }
    //Hvis response er ok, henter vi json data 
    var json = await res.json()
    console.log('Hentede poster fra fetchJSON', json)
    return json 
}


//title, text: overskrift og brødtekst på kortet
//image: valgfri URL — udelades der intet <img>
//callback: valgfri. Kan også sendes som 3. argument. Viser et × der kalder funktionen
function createCard(title = "", text = "", image = "", callback){
    if(typeof image === 'function'){
        callback = image
        image = ""
    }
    var card = createDiv().addClass('card')
    if(image) card.child(createImg(image))
    card.child(createElement('h2', title))
    card.child(createElement('p', text))
    if(callback){
        var del = createElement('span', '×').addClass('card-delete')
        del.mousePressed(callback)
        card.child(del)
    }
    return card
}

//from, to: start og slut i sekunder — fx 1, 14 tæller op, 14, 1 tæller ned
//corner: top-left, top-right, bottom-left eller bottom-right
//callback: kaldes når timeren rammer to
//bg: valgfrit baggrundsbillede bag tiden
function startTimer(from, to, corner = 'top-right', callback, bg) {
    selectAll('.timer').map(el => el.remove())
    var timer = createDiv(from)
    timer.addClass('timer')
    timer.addClass(corner)
    if (bg) timer.style('background-image', 'url(' + bg + ')')

    // Skal vi tælle op eller ned?
    var step = from < to ? 1 : -1
    var now = from

    var tick = setInterval(() => {
        now += step
        timer.html(now)

        // Er vi i mål?
        if (now === to) {
            clearInterval(tick)
            callback(now)
        }
    }, 1000)

    return timer
}

//id: CSS-selektor til et input, fx '#ball-x'
//Returnerer feltets værdi som tal
function num(id){
    return Number(select(id).value())
}

//id: CSS-selektor til et input
//Returnerer feltets værdi som tekst
function txt(id){
    return select(id).value()
}

//ids: array af CSS-selektorer
//fn: kaldes når ét af felterne ændres
function wireInputs(ids, fn){
    ids.map(id => select(id).input(fn))
}

//el: CSS-selektor eller p5-element til <input type="file">
//onLoad: kaldes med et p5-billede, eller null hvis feltet tømmes
function wireFile(el, onLoad){
    if(typeof el == 'string') el = select(el)
    el.changed(function(){
        var file = this.elt.files[0]
        if(!file){
            onLoad(null)
            return
        }
        loadImage(URL.createObjectURL(file), onLoad)
    })
}

//Bredde til canvas: fuld vinduesbredde under 801px, ellers minus sidebaren
//sidebar: CSS-selektor, defaults til '.sidebar'
function canvasWidth(sidebar = '.sidebar'){
    if(windowWidth <= 800) return windowWidth
    var bar = select(sidebar)
    if(!bar) return windowWidth
    return windowWidth - bar.elt.offsetWidth
}

//Tilpas canvas til canvasWidth() og fuld højde
function sizeCanvas(sidebar = '.sidebar'){
    resizeCanvas(canvasWidth(sidebar), windowHeight)
}

function windowResized(){
    sizeCanvas()
}