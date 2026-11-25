
var shoot
var canvas
var SebOpps = []
var dead
var shots


class SebBall {
  constructor(x, y, r, img, col, xSpeed, ySpeed, bounds){ 
    this.diam = r
    this.velocity = createVector(xSpeed || 0, ySpeed || 0)
    this.position = createVector(x, y)
    this.img = img
    this.col = col
    if(img) this.img = img
    if(col) this.col = col
    this.bounds = bounds || [false, false, false, false]
    this.mass = this.diam
    this.fixed = false
  }
  update(){
    this.position.add(this.velocity)
    if(this.position.x < 160){
      dead = true
    }
  }
  show(){
    if(this.img){
      imageMode(CENTER)
      image(this.img, this.position.x, this.position.y, this.diam, this.diam)
    }else if(this.col){
      noStroke()
      fill(this.col)
      circle(this.position.x, this.position.y, this.diam)
      
    }
  }
  constrain(){
    var r = this.diam / 2
    var b = this.bounds
    if(b[0] && this.position.x < r){
      this.position.x = r
      this.velocity.x *= -1
    }
    if(b[1] && this.position.x > width - r){
      this.position.x = width - r
      this.velocity.x *= -1
    }
    if(b[2] && this.position.y < r){
      this.position.y = r
      this.velocity.y *= -1
    }
    if(b[3] && this.position.y > height - r){
      this.position.y = height - r
      this.velocity.y *= -1
    }
  }
  hit(anotherBall){
    var b = anotherBall
    var totalR = (this.diam + b.diam) / 2
    var d = dist(this.position.x, this.position.y, b.position.x, b.position.y)
    return d <= totalR
  }
  destruct(SebOpp){
    this.velocity = createVector(0, 0)
  }

}

class SebMovingBall extends SebBall{
  constructor(x, y, r, img, speed, col, bounds){
    super(x, y, r, img, col, 0, 0, bounds)
    this.speed = speed
    this.heading = createVector(1, 0)
  }

  forward(){
    this.velocity.set(this.heading.y * this.speed, this.heading.x * this.speed)
  }
  back(){
    this.velocity.set(this.heading.y * -this.speed, this.heading.x * -this.speed)
  }
  stop(){
    this.velocity.set(0)
  }

  update(){
    this.heading.normalize()
    super.update()
  }

  show(){
    super.show()
    var tip = this.heading.copy().setMag(this.diam)
    stroke(0)
    strokeWeight(3)
    line(this.position.x, this.position.y, this.position.x + tip.x, this.position.y + tip.y)
  }
}

class SebShootingBall extends SebMovingBall{
  constructor(x, y, r, img, speed, bulletSpeed, col, bounds){
    super(x, y, r, img, speed, col, bounds)
    this.bulletSpeed = bulletSpeed
    this.bullets = []
  }

  shoot(){
    if(shots > 0){
      this.bullets.push(new SebBullet(
        this.position.x + this.heading.x * this.diam,
        this.position.y + this.heading.y * this.diam,
        this.heading,
        this.bulletSpeed,
        this.col
      ))
      shots -= 1
      shotsH.innerHTML = `<h2>${shots} shots</h2>`
    }
  }

  update(){
    super.update()
    this.bullets.map(b => b.update())
    this.bullets = this.bullets.filter(b => !b.isGone())
  }

  show(){
    super.show()
    this.bullets.map(b => b.show())
  }
}

class SebBullet extends Ball{
  constructor(x, y, heading, speed, col){
    super(x, y, 16, null, col || '#111', heading.x * speed, heading.y * speed)
  }

  isGone(){
    return this.position.x < 0 || this.position.x > width || this.position.y < 0 || this.position.y > height
  }
}


function draw(){
    if(currentPage == '#page6'){
        background('peachpuff')
        
        steer(shoot)
        shoot.update()
        shoot.constrain()

        SebOpps.forEach(n => {
          n.show()
          n.update()
        })
        
        

        shoot.bullets.map(b => {
            SebOpps.forEach(n => {
              if(b.hit(n)){
                n.destruct()
              }
            })
        })
        shoot.show()
    }
}


function steer(b){
    if(keyIsDown(DOWN_ARROW)) b.forward()
    if(keyIsDown(83)) b.forward()
    if(keyIsDown(UP_ARROW)) b.back()
    if(keyIsDown(87)) b.back()
    if(!keyIsDown(87) && !keyIsDown(83) && !keyIsDown(UP_ARROW) && !keyIsDown(DOWN_ARROW)) b.stop()
    
}


function keyPressed(){
    if(currentPage == '#page6' && key == ' ') shoot.shoot()
    if(keyCode == UP_ARROW || keyCode == DOWN_ARROW || keyCode == LEFT_ARROW || keyCode == RIGHT_ARROW) return false
}