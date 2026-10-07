class Ball {
  constructor(x, y, r, img, col, xSpeed, ySpeed, bounds){ 
    this.diam = r
    this.velocity = createVector(xSpeed || 0, ySpeed || 0)
    this.position = createVector(x, y)
    this.img = null
    this.col = null
    if(typeof img === 'string'){
      this.col = img
    } else if(img){
      this.img = img
    }
    if(col) this.col = col
    this.bounds = bounds || [false, false, false, false]
    this.mass = this.diam
    this.fixed = false
  }
  update(){
    this.position.add(this.velocity)
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

  bounce(other){
    // --- FASE 1: Rører de hinanden? ---
    var normal = p5.Vector.sub(this.position, other.position)
    var afstand = normal.mag()
    if(afstand === 0) normal.set(1, 0) // Undgå at dele med 0, hvis de ligger præcis oven i hinanden
    else normal.normalize()

    var overlap = (this.diam + other.diam) / 2 - afstand
    if(overlap <= 0) return // De rører ikke hinanden, afbryd.

    // --- FASE 2: Skub dem fra hinanden (så de ikke sidder fast) ---
    // Vi bruger invers masse. Fixed bolde har værdien 0 og lader sig ikke rykke.
    var invM1 = this.fixed ? 0 : 1 / this.mass
    var invM2 = other.fixed ? 0 : 1 / other.mass
    var sumInvM = invM1 + invM2
    if(sumInvM === 0) return // Begge bolde er fixed, vi stopper her.

    // Skub boldene væk fra hinanden, proportionelt med hvor "lette" de er.
    this.position.add(p5.Vector.mult(normal, overlap * (invM1 / sumInvM)))
    other.position.sub(p5.Vector.mult(normal, overlap * (invM2 / sumInvM)))

    // --- FASE 3: Selve bouncet (ændring af hastighed) ---
    // Hvor hurtigt bevæger de sig direkte imod hinanden?
    var relativHastighed = p5.Vector.sub(this.velocity, other.velocity)
    var fartModHinanden = relativHastighed.dot(normal)

    // Hvis de allerede bevæger sig væk fra hinanden, skal vi ikke gøre mere.
    if(fartModHinanden >= 0) return

    // Udregn stød-kraften (impuls). Tallet 2 betyder 100% elastisk stød (ingen energi går tabt).
    var stødKraft = -(2 * fartModHinanden) / sumInvM
    var stødVektor = p5.Vector.mult(normal, stødKraft)

    // Påfør stød-kraften på boldenes hastighed, igen baseret på hvor lette de er.
    this.velocity.add(p5.Vector.mult(stødVektor, invM1))
    other.velocity.sub(p5.Vector.mult(stødVektor, invM2))
    this.didBounce = true
    other.didBounce = true
  }
}

class JumpingBall extends Ball{
  constructor(x, y, r, img, jump, col, bounds){
    super(x, y, r, img, col, 0, 0, bounds || [false, false, false, true])
    this.jumpForce = jump
  }
  update(){
    this.velocity.add(gravity)
    this.velocity.y *= friction
    super.update()
  }
  jump(){
    this.velocity.y -= this.jumpForce
  }
}

class SpringBall extends Ball{
  constructor(x, y, r, img, maxDragDist, col, bounds){
    super(x, y, r, img, col, 0, 0, bounds)
    this.start = createVector(x, y)
    this.maxDragDist = maxDragDist
    this.isFlying = false
    this.isDragging = false
    this.hasHit = false
  }

  drag(){
    var mouse = createVector(mouseX, mouseY)
    mouse.sub(this.start)
    if(mouse.mag() > this.maxDragDist) mouse.setMag(this.maxDragDist)
    this.position = this.start.copy()
    this.position.add(mouse)
    this.isDragging = true
  }

  launch(){
    this.velocity = this.start.copy()
    this.velocity.sub(this.position)
    this.velocity.mult(0.15) // 0.15 dæmper farten, så bolden ikke flyver for hurtigt
    this.isFlying = true
    this.isDragging = false
  }

  reset(){
    this.position = this.start.copy()
    this.velocity = createVector(0, 0)
    this.isFlying = false
    this.isDragging = false
    this.hasHit = false
  }

  update(){
    if(!this.isFlying) return
    this.velocity.add(gravity)
    super.update()
  }

  show(){
    noFill()
    stroke(255, 70)
    strokeWeight(1)
    circle(this.start.x, this.start.y, this.maxDragDist * 2)
    if(this.isDragging){
      line(this.start.x, this.start.y, this.position.x, this.position.y)
    }
    super.show()
  }
}

class MovingBall extends Ball{
  constructor(x, y, r, img, speed, col, bounds){
    super(x, y, r, img, col, 0, 0, bounds)
    this.speed = speed
    this.heading = createVector(1, 0)
  }

  left(){
    this.heading.x -= 0.1
  }
  right(){
    this.heading.x += 0.1
  }
  up(){
    this.heading.y -= 0.1
  }
  down(){
    this.heading.y += 0.1
  }
  forward(){
    this.velocity.set(this.heading.x * this.speed, this.heading.y * this.speed)
  }
  back(){
    this.velocity.set(this.heading.x * -this.speed, this.heading.y * -this.speed)
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

class ShootingBall extends MovingBall{
  constructor(x, y, r, img, speed, bulletSpeed, col, bounds){
    super(x, y, r, img, speed, col, bounds)
    this.bulletSpeed = bulletSpeed
    this.bullets = []
  }

  shoot(){
    this.bullets.push(new Bullet(
      this.position.x + this.heading.x * this.diam,
      this.position.y + this.heading.y * this.diam,
      this.heading,
      this.bulletSpeed,
      this.col
    ))
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

class Bullet extends Ball{
  constructor(x, y, heading, speed, col){
    super(x, y, 16, null, col || '#111', heading.x * speed, heading.y * speed)
  }

  isGone(){
    return this.position.x < 0 || this.position.x > width || this.position.y < 0 || this.position.y > height
  }
}

class Firebase {
  constructor(collection) {
    this.ref = db.collection(collection)
  }

  save(name, points) {
    this.ref.add({
      name: name,
      points: points,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
  }

  listen(onUpdate, limit, sort, dir='desc') {
    var q = this.ref.orderBy(sort, dir)
    if(limit) q = q.limit(limit)
    return q.onSnapshot(snap => {
      var list = []
      snap.forEach(doc => {
        var d = doc.data()
        d.id = doc.id
        list.push(d)
      })
      onUpdate(list)
    })
  }

  remove(id) {
    this.ref.doc(id).delete()
  }

  clear() {
    this.ref.get().then(snap => {
      snap.forEach(doc => doc.ref.delete())
    })
  }
}