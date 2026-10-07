// Flowcharts — Mermaid med Whimsical-farver.
// Kanon: ~/.cursor/skills/whimsical-flowcharts/
// Start/slut: (["tekst"])   proces: ["tekst"]   valg: {"tekst"}
// Skriv mermaid i et element med klassen .flowchart

var MERMAID_SRC = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'

function mermaidTheme(){
  return {
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '13px',
      primaryColor: '#ffffff',
      primaryTextColor: '#44515c',
      primaryBorderColor: '#6a7d8c',
      secondaryColor: '#ffffff',
      tertiaryColor: '#f2f4f6',
      lineColor: '#6a7d8c',
      arrowheadColor: '#6a7d8c',
      clusterBkg: 'transparent',
      clusterBorder: 'transparent',
      edgeLabelBackground: '#f2f4f6',
      titleColor: '#44515c',
      nodeTextColor: '#44515c'
    },
    flowchart: {
      htmlLabels: true,
      curve: 'linear',
      padding: 12,
      nodeSpacing: 28,
      rankSpacing: 48,
      useMaxWidth: true,
      diagramPadding: 8
    }
  }
}

function drawFlowcharts(){
  if(typeof mermaid === 'undefined') return
  mermaid.initialize(mermaidTheme())
  var nodes = document.querySelectorAll('.flowchart')
  if(nodes.length) mermaid.run({ nodes: nodes })
}

function loadMermaid(done){
  if(typeof mermaid !== 'undefined'){
    done()
    return
  }
  var s = document.createElement('script')
  s.src = MERMAID_SRC
  s.onload = done
  document.head.appendChild(s)
}

function startFlowcharts(){
  loadMermaid(drawFlowcharts)
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', startFlowcharts)
} else {
  startFlowcharts()
}
