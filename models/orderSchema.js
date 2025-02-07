const { MongoOIDCError } = require("mongodb");
const mongoose = require("mongoose");
const {Schema} = mongoose;
const {v4:uuidv4} = require("uuid");

const orderSchema = new Schema({
    orderId:{
        type: String,
        required: true,
        unique: true
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
            enum:["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"],
            default:"Pending",
        },
        reason: {
            type: String,
            default: null
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
        type:Number,
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
    payment_status: {
        type: String,
        enum: ['Pending', 'completed', 'Failed'],
        default: 'Pending'
    },
    paymentMethod: {
        type: String,
        enum: ['Cash On Delivery', 'razorpay', 'wallet'],
        required: true
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