const mongoose=require("mongoose")
const {Schema}=mongoose;

const addressSchem=new Schema({
  userId:{
    type:Schema.Types.ObjectId,
    ref:"User",
    required:true
  },
  address:[{
    addressType:{
      type:String,
      required:true
    },
    name:{
      type:String,
      required:true
    },
    city:{
      type:String,
      required:true,
    },
    landMark:{
      type:String,
      reduired:true,
    },
    state:{
      type:String,
      required:true
    },
    pincode:{
      type:Number,
      required:true,
    },
    phone:{
      type:String,
      required:true,
    },
    altPhone:{
      type:String,
      required:true,
    }
  }]
})

const Address=mongoose.model("Address",addressSchem)

module.exports=Address;