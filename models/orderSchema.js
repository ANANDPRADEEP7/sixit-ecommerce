const { MongoOIDCError } = require("mongodb");
const mongoose = require("mongoose");
const {Schema} = mongoose;
const {v4:uuidv4} = require("uuid");

const orderSchema = new Schema({
    orderId:{
        type:String,
        default:()=>uuidv4(),
        unique:true
    },
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    orderedItems:[{
        name:{
            type:String,
            required:true

        },
        quantity:{
            type:Number,
            required:true
        },
        price:{
            type:String,
            default:0
        },
        id:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        status:{
            type:String,
            enum:["pending","Processing","Shipped","Delivered","Cancelled"],
            default:"pending",
        },
    }],
    totalPrice:{
        type:Number,
        required:true
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:String,
        required:true
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    couponApplied:{
        type:Boolean,
        default:false
    },
    shippingAddress:{
      
        name:{
            type:String,
            required:true
        },
        addressType:{
            type:String,
            required:true
        },
        city:{
            type:String,
            required:true
        },
        state:{
            type:String,
            required:true
        },
        landmark:{
            type:String,
            required:true
        },
       
        pincode:{
            type:Number,
            required:true
        },
        phone:{
            type:String,
            required:true
        },
        altPhone:{
            type:String,
        },
    
    },
    paymentMethod:{
        type:String,
        
     },
     payment_status:{
         type:String,
     },
     razorpayOrderId: String,
     paymentDetails: {
       razorpayOrderId: String,
       razorpayPaymentId: String,
       razorpaySignature: String
     }
});

const Order = mongoose.model("Order",orderSchema);

module.exports =Order;