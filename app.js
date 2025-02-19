const express=require('express')
const app=express()
const path=require('path')
const session=require("express-session")
const passport=require("./config/passport")
const dotenv=require('dotenv')
dotenv.config()
const db=require('./config/db')
const userRouter=require("./routes/userRouter")
const adminRouter=require("./routes/adminRouter")
const lodeHomepage=require("./controllers/user/userController")
const countItems = require("./middlewares/countItems")
const { rmSync } = require('fs')

db()

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(session({
  secret:process.env.SESSION_SECRET,
  resave:false,
  saveUninitialized:true,
  cookie:{
    secure:false,
    httpOnly:true,
    maxAge:72*60*60*1000
  }
}))

app.use(countItems);

app.use(passport.initialize());
app.use(passport.session());

app.use((req,res,next)=>{
  res.set("cache-control","no-store")
  next()
})
app.set("view engine", "ejs");
app.set("views", [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'views/admin'),
  path.join(__dirname, 'views/user')
]);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/',userRouter);
app.use('/admin',adminRouter);

const PORT = process.env.PORT || 3020;
app.listen(PORT, () => {
    console.log(`Server Running At http://localhost:${PORT}`);
});

module.exports=app;