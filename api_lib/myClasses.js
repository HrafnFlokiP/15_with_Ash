class Ball {
  constructor(x, y, r, col, jump, rx, ry){ 
    this.diam = r
    this.col = col
    this.velocity = createVector(0, 0)
    this.position = createVector(x, y)
    this.jumpForce = jump
    this.rx = rx
    this.ry = ry
  }
  update(){
    this.velocity.add(gravity)
    this.velocity.y *= friction 
    this.position.add(this.velocity)

    this.position.x -= this.rx;
    this.position.y -= this.ry;
  }
  constrain(){
    if(this.position.y > height - this.diam/2){
      this.position.y = height - this.diam/2
      this.velocity.y *= -1
    }

    if(this.position.x > width - this.diam/2){
      this.position.x = width - this.diam/2
      this.rx *= -1
    }

    if(this.position.x < width){
      this.position.x = width
      this.rx *= -1
    }
  }
  jump(){
    this.velocity.y -= this.jumpForce
  }
  
  show(){
    fill(this.col)
    circle(this.position.x, this.position.y, this.diam)
  }
  hit(anotherBall){
    var b = anotherBall
    var totalR = (this.diam + b.diam) / 2
    var d = dist(this.position.x, this.position.y, b.position.x, b.position.y)

    if(d <= totalR){
        return true
    }else{
        return false
    }
  }
  click(mx, my){
    if(dist(mx, my, this.position.x, this.position.y) < 40){
      this.aiming = true
    }
  }

  launch(mx, my) {
    if(dist(mx, my, this.position.x, this.position.y) > 15) {
      this.rx = (mx - this.position.x) * 0.015;
      this.ry = (my - this.position.y) * 0.015;

    }
  }

  draw(){
    if(this.aiming){
      stroke(255, 0, 0, 180);
      strokeWeight(2);
      line(this.position.x, this.position.y, mouseX, mouseY);

      let pullX = (this.position.x - mouseX) * 0.14;
      let pullY = (this.position.y - mouseY) * 0.14;
      let dotX = this.position.x;
      let dotY = this.position.y;

      fill(255, 220, 0);
      noStroke();
      for (let i = 0; i < 160; i++) {
        pullY += 0.38;
        dotX += pullX;
        dotY += pullY;
        circle(dotX, dotY, 4)
      }
    }
  }
}

class FloatingBall extends Ball{
    constructor(x, y, r, col, jump, speed){
        //super betyder at vi overtager disse argumenter fra "super" klassen (Ball)
        super(x, y, r, col, jump)
        //vi overskriver velocity vektoren med en lokal der flytter sig på x aksen 
        this.velocity = createVector(speed, 0)
    }
    update(){
        this.position.add(this.velocity)
    }

    constrain(){
        //sørg for at floatingball bouncer på siderne
        this.position.x = constrain(this.position.x, this.diam/2, windowWidth - this.diam/2) 

        if(this.position.x <= this.diam/2 || this.position.x >= windowWidth - this.diam/2){
            this.velocity.mult(-1)
        }
    }

}