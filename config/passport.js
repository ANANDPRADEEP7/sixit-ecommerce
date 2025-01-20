const passport =require("passport");
const GoogleStrategy=require("passport-google-oauth20").Strategy;
// const user=require("/models/userSchema");
const User = require("../models/userSchema");
const env=require("dotenv").config();



// passport.use(new GoogleStrategy({
//   clientID:process.env.GOOGLE_CLINT_ID,
//   clientSecret:process.env.GOOGLE_CLINT_SECRET,
//   callbackURL:'/auth/google/callback'
// },
// async(accessTocken,referenceTocken,profile,done)=>{
//   try {
//     console.log('sdfghdfghjkl');
    
//     let user=await User.findOne({googleId:profile.id});
//     if(user){
//       return done(null,user);
//     }else {
//       console.log("dfghjkl,hjkl");
//       user=new User({
//         name:profile.displayName,
//         email: profile.email && profile.email[0] ? profile.email[0].value : null,
//         googleId:profile.id,
//       }),
//       console.log('zzzzzzzzzzzzzzzz');
//       await user.save();
//       return done(null,user);
//     }
//   } catch (error) {
//     return done(error,null);
//   }
// }
// ));


// passport.serializeUser((user,done)=>{
//   done(null,user.id);
// });

// passport.serializeUser((id,done)=>{
//   user.findById(id)
//   .then(user=>{
//     done(null,user)
//   })
//   .catch(error=>{
//     done(error,null)
//   })
// })


passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLINT_ID,
      clientSecret: process.env.GOOGLE_CLINT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log("Google Profile:", profile); // Debugging the profile object

        let user = await User.findOne({ googleId: profile.id });
        if (user) {
         return done(null,user)
        } else {
          console.log("New user, saving to database...");
          user = new User({
            name: profile.displayName,
            email: profile.emails && profile.emails[0] ? profile.emails[0].value : null, // Safely accessing email
            googleId: profile.id,
          });
          console.log("Saving new user...");
          await user.save();
          return done(null, user);
        }
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

module.exports=passport;