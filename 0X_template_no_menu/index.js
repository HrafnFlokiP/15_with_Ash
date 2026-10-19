const roughCanvas = rough.canvas(document.getElementById('myCanvas'));
const svg = document.getElementById('svg');
const roughSvg = rough.svg(svg);

//roughCanvas.line(60, 60, 190, 60);
//roughCanvas.line(60, 60, 190, 60, {strokeWidth: 5});

//const line = roughSvg.line(60, 60, 190, 60);
//svg.appendChild(line);

roughCanvas.rectangle(60, 60, 300, 300, {
    //bowing: 36,
    fill: 'red',
    hachureAngle: 90, // angle of hachure,
    hachureGap: 8,
    roughness: 4
}); // x, y, width, height

//P5 setup() bliver kaldt EN gang før siden vises 
function setup(){
}
