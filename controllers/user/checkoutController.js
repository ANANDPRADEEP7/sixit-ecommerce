const User = require("../../models/userSchema")
const Cart = require("../../models/cartSchema");
const Category = require("../../models/categorySchema");
const Address = require("../../models/addressSchema");
const Order = require('../../models/orderSchema');
const Product = require("../../models/productSchema");
const Coupon = require("../../models/couponSchema");
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const walletController = require('./walletController'); // Assuming walletController is in the same directory

// Initialize Razorpay
let razorpay;
try {
    // Log environment variables loading
  
    // Test with direct initialization
    razorpay = new Razorpay({
        key_id: 'rzp_test_5KZZZMvpPLEQ2p',
        key_secret: 'dXJ6kqT9eLrSFMygVBaqqicz'
    });

    // Test the Razorpay connection immediately
 
    razorpay.orders.all()
        .then(() => {
            console.log('✓ Razorpay credentials verified successfully');
        })
        .catch((error) => {
            console.error('✗ Razorpay credentials verification failed:', {
                code: error.statusCode,
                error: error.error,
                description: error.description
            });
        });

} catch (error) {
    console.error('Error initializing Razorpay:', error.message);
}

const checkOutPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const cart = await Cart.findOne({ userId }).populate("items.productId")
        const userAddress = await Address.findOne({ userId });
        const categories = await Category.find({ isListed: true })

        const listedCategory = categories.map(category => category._id.toString())

        const cartItems = cart.items.filter(item => {
            const product = item.productId
            return (product.isBlocked === false && listedCategory.includes(product.category.toString()))
        });

        // Calculate cart total
        let total = 0;
        if (cartItems) {
            total = cartItems.reduce((sum, item) => {
                return sum + (item.totalPrice);
            }, 0);
        }

        // Get available coupons
        const currentDate = new Date();
        const availableCoupons = await Coupon.find({
            isList: true,
            expireOn: { $gt: currentDate }
        }).lean();  

        // Format coupons for display
        const coupons = availableCoupons.map(coupon => ({
            _id: coupon._id,
            name: coupon.name,
            offerPrice: coupon.offerPrice,
            minimumPrice: coupon.minimumPrice,
            expireOn: coupon.expireOn
        }));

     

        let shippingCost = 0;
        let discount = 0;
        const subTotal = total;
        const finalTotal = total + shippingCost;

        res.render("user/checkout", {
            user: userId,
            userData,
            cart: cartItems,
            addresses: userAddress ? userAddress.address : [],
            subTotal,
            total: finalTotal,
            shippingCost,
            discount,
            coupons: coupons || [] 
        });
    } catch (error) {
        console.error("Error in showing checkout page", error);
        res.redirect("/pageNotFound")
    }
}

const applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.session.user;

      

        // Find the coupon
        const coupon = await Coupon.findOne({
            name: couponCode,
            isList: true,
            expireOn: { $gt: new Date() }
        });

     

        if (!coupon) {
            return res.json({
                success: false,
                message: 'Invalid or expired coupon code'
            });
        }

        // Get cart total
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        const categories = await Category.find({ isListed: true });
        const listedCategory = categories.map(category => category._id.toString());
        
        const cartItems = cart.items.filter(item => {
            const product = item.productId;
            return (product.isBlocked === false && listedCategory.includes(product.category.toString()));
        });

        const total = cartItems.reduce((sum, item) => sum + (item.totalPrice), 0);

        

        // Check minimum purchase requirement
        if (coupon.minimumPrice && total < coupon.minimumPrice) {
            return res.json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minimumPrice} required for this coupon`
            });
        }

        // Calculate discount
        const discount = Math.min(coupon.offerPrice, total);

  

        res.json({
            success: true,
            discount: discount,
            message: 'Coupon applied successfully'
        });

    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({
            success: false,
            message: 'Error applying coupon'
        });
    }
};

const checkOutAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });

        if (!userData) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            });
        }

        const { name, phone, addressType, city, state, landmark, pincode, altPhone } = req.body;
      

        // Validate required fields
        if (!name || !phone || !addressType || !city || !state || !pincode|| !landmark) {
            return res.status(400).json({
                success: false,
                message: "All required fields must be filled"
            });
        }

        // Find or create address document
        let userAddress = await Address.findOne({ userId: userData._id });

        const newAddressData = {
            addressType,
            name,
            city,
            landMark:landmark,
            state,
            pincode,
            phone,
            altPhone
        };

        if (!userAddress) {
            // Create new address document
            userAddress = new Address({
                userId: userData._id,
                address: [newAddressData]
            });
        } else {
            // Add to existing addresses
            userAddress.address.push(newAddressData);
        }

        await userAddress.save();

        return res.status(200).json({
            success: true,
            message: "Address added successfully"
        });

    } catch (error) {
        console.error("Add address error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

const postCheckout = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Please login to continue" });
        }

        const { address, products, subtotal, total, paymentMethod, coupon } = req.body;

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ success: false, message: "No products in cart" });
        }

        if (!address || !address.id) {
            return res.status(400).json({ success: false, message: "Shipping address not selected" });
        }

        // Check if COD is allowed for this order amount
        if (paymentMethod === "Cash On Delivery" && total > 1000) {
            return res.status(400).json({
                success: false,
                message: "Cash on Delivery is not available for orders above ₹1000"
            });
        }

        // Validate and update product quantities
        for (const item of products) {
            const product = await Product.findById(item.id);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: `Product not found: ${item.name}`
                });
            }

            if (product.quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough stock for product: ${item.name}`,
                });
            }

            // Update product quantity
            product.quantity -= item.quantity;
            await product.save();
        }

        // Generate a unique order ID using timestamp and random number
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const orderId = `ORD${timestamp}${random}`;

        // Create order with required fields matching schema
        const newOrder = new Order({
            userId,
            orderId, // Add the generated orderId
            orderedItems: products.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price.toString(),
                status: paymentMethod === "Cash On Delivery" ? "Processing" : "Pending"
            })),
            shippingAddress: address,
            totalPrice: subtotal,
            finalAmount: total,
            status: paymentMethod === "Cash On Delivery" ? "Processing" : "Pending",
            paymentMethod,
            payment_status: paymentMethod === "Cash On Delivery" ? "Pending" : "Pending",
            coupon: coupon,
            createdOn: new Date()
        });

        const savedOrder = await newOrder.save();

        if (!savedOrder) {
            return res.status(500).json({
                success: false,
                message: "Failed to create order"
            });
        }

        // If Razorpay payment method, create Razorpay order
        if (paymentMethod === "razorpay") {
            try {
                if (!razorpay) {
                    throw new Error('Razorpay is not properly initialized');
                }

                const orderAmount = Math.round(total * 100);
                console.log('Creating Razorpay order:', {
                    amount: orderAmount,
                    currency: 'INR',
                    receipt: savedOrder._id.toString()
                });

                const razorpayOrder = await razorpay.orders.create({
                    amount: orderAmount,
                    currency: 'INR',
                    receipt: savedOrder._id.toString(),
                    notes: {
                        orderId: savedOrder._id.toString()
                    }
                });

                if (!razorpayOrder || !razorpayOrder.id) {
                    throw new Error('Invalid order response from Razorpay');
                }

                return res.status(200).json({
                    success: true,
                    orderId: savedOrder._id,
                    razorpayOrder: {
                        id: razorpayOrder.id,
                        amount: razorpayOrder.amount,
                        currency: razorpayOrder.currency,
                        key: 'rzp_test_5KZZZMvpPLEQ2p'
                    }
                });
            } catch (error) {
                console.error('Razorpay order creation error:', {
                    message: error.message,
                    details: error.error || error,
                    stack: error.stack
                });
                // If Razorpay order creation fails, delete the saved order
                await Order.findByIdAndDelete(savedOrder._id);
                throw new Error("Failed to create Razorpay order: " + error.message);
            }
        } else if (paymentMethod === "wallet") {
            try {
                // Get user's wallet
                const wallet = await walletController.getWalletDetails(req, res);
                
                // Check if wallet has sufficient balance
                if (wallet.balance < total) {
                    await Order.findByIdAndDelete(savedOrder._id);
                    return res.status(400).json({
                        success: false,
                        message: "Insufficient wallet balance"
                    });
                }

                // Debit amount from wallet
                const walletResponse = await walletController.useWalletBalance(
                    userId,
                    total,
                    `Payment for order #${savedOrder.orderId}`,
                    'debit'
                );

                if (!walletResponse.success) {
                    await Order.findByIdAndDelete(savedOrder._id);
                    return res.status(400).json({
                        success: false,
                        message: walletResponse.message || "Failed to process wallet payment"
                    });
                }

                // Update order status
                savedOrder.payment_status = 'completed';
                savedOrder.orderedItems.forEach(item => {
                    item.status = 'Processing';
                });
                await savedOrder.save();

                // Clear cart after successful payment
                await Cart.findOneAndDelete({ userId });

                return res.status(200).json({
                    success: true,
                    message: "Order placed successfully using wallet balance",
                    orderId: savedOrder._id,
                    order: savedOrder
                });
            } catch (error) {
                console.error("Wallet payment error:", error);
                await Order.findByIdAndDelete(savedOrder._id);
                throw new Error("Failed to process wallet payment: " + error.message);
            }
        }

        // For non-Razorpay payments (COD), clear cart and return success
        await Cart.findOneAndUpdate(
            { userId },
            { $set: { items: [] } }
        );

        return res.status(200).json({
            success: true,
            message: "Order placed successfully",
            orderId: savedOrder._id
        });

    } catch (error) {
        console.error("Checkout error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
};

const orderComform = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect("/signup");
        }
        
        const orderId = req.query.id;
        const msg = req.query.msg;
        
        if (!orderId) {
            return res.redirect("/pageNotFound");
        }

        let order;
        if (msg === "repayment") {
            order = await Order.findOne({ orderId: orderId });
        } else {
            // Validate if orderId is a valid ObjectId
            if (!mongoose.Types.ObjectId.isValid(orderId)) {
                return res.redirect("/pageNotFound");
            }
            order = await Order.findById(orderId);
        }

        if (!order) {
            return res.redirect("/pageNotFound");
        }

        const userData = await User.findById(req.session.user);

        res.render("orderComform", {
            user: req.session.user,
            userData,
            order
        });
    } catch (error) {
        console.error("Error in order confirmation:", error);
        res.redirect("/pageNotFound");
    }
};

const createRazorpayOrder = async (req, res) => {
    try {
        const { amount, selectedAddress } = req.body;
        const userId = req.session.user;

        // Create Razorpay order
        const options = {
            amount: Math.round(amount * 100), // Razorpay expects amount in paise
            currency: "INR",
            receipt: "order_" + Date.now(),
        };

        const order = await razorpay.orders.create(options);

        res.json({
            success: true,
            order,
            key: 'rzp_test_5KZZZMvpPLEQ2p' // Using the test key directly
        });
    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Error creating payment order"
        });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId
        } = req.body;

        // Verify the payment signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            // Update order status and payment details
            await Order.findByIdAndUpdate(orderId, {
                $set: {
                    'orderedItems.$[].status': 'Processing',
                    payment_status: 'completed',
                    paymentDetails: {
                        razorpayOrderId: razorpay_order_id,
                        razorpayPaymentId: razorpay_payment_id,
                        razorpaySignature: razorpay_signature
                    }
                }
            });

            // Clear cart after successful payment
            const order = await Order.findById(orderId);
            if (order) {
                await Cart.findOneAndUpdate(
                    { userId: order.userId},
                    { $set: { items: [] } }
                );
            }

            res.json({ 
                success: true,
                orderId: orderId
            });
        } else {
            // Update order status to pending and payment status to failed
            await Order.findByIdAndUpdate(orderId, {
                $set: {
                    'orderedItems.$[].status': 'pending',
                    payment_status: 'pending'
                }
            });

            res.status(400).json({
                success: false,
                message: "Payment verification failed. Please try again."
            });
        }
    } catch (error) {
        console.error("Error verifying payment:", error);
        
        // Update order status to pending and payment status to failed on error
        if (orderId) {
            try {
                await Order.findByIdAndUpdate(orderId, {
                    $set: {
                        'orderedItems.$[].status': 'pending',
                        payment_status: 'pending'
                    }
                });
            } catch (updateError) {
                console.error("Error updating order status:", updateError);
            }
        }

        res.status(500).json({
            success: false,
            message: "Error verifying payment. Please check your order status."
        });
    }
};

const retryPayment = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        const userId = req.session.user;

        console.log('Retry payment request:', { orderId, amount, userId });

        // Find the order and verify it belongs to the user
        const order = await Order.findOne({ userId: userId, _id: orderId });
        console.log('Found order:', order);
        
        if (!order) {
            console.error('Order not found:', { orderId, userId });
            return res.status(404).json({ error: 'Order not found' });
        }

        // Create new Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(parseFloat(amount) * 100), // Convert to paise
            currency: 'INR',
            receipt: orderId,
            notes: {
                orderId: orderId
            }
        });
        console.log('Created Razorpay order:', razorpayOrder);

        // Get user details
        const user = await User.findById(userId);
        if (!user) {
            console.error('User not found:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        const response = {
            key_id: 'rzp_test_5KZZZMvpPLEQ2p', // Using the hardcoded test key
            order_id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            order: order,
            user: {
                name: user.name || '',
                email: user.email || '',
                mobile: user.mobile || ''
            }
        };
        console.log('Sending response:', response);
        res.json(response);

    } catch (error) {
        console.error('Retry payment error:', error);
        res.status(500).json({ error: 'Failed to create payment order' });
    }
};

const verifyRetryPayment = async (req, res) => {
    try {
        const { payment, order } = req.body;
        const userId = req.session.user;

        console.log('Verify retry payment request:', { payment, orderId: order._id, userId });

        // Find the order first
        const existingOrder = await Order.findOne({ _id: order._id, userId: userId });
       
        
        if (!existingOrder) {
            console.error('Order not found during verification:', { orderId: order._id, userId });
            return res.status(404).json({ error: 'Order not found' });
        }

        // Verify the payment signature
        const sign = payment.razorpay_order_id + '|' + payment.razorpay_payment_id;
        const expectedSign = crypto
            .createHmac('sha256', 'dXJ6kqT9eLrSFMygVBaqqicz')  // Using the hardcoded test secret
            .update(sign)
            .digest('hex');

        if (expectedSign !== payment.razorpay_signature) {
            console.error('Invalid payment signature');
            return res.status(400).json({ error: 'Invalid payment signature' });
        }

        // Update order status
        const updatedOrder = await Order.findOneAndUpdate(
            { _id: order._id, userId: userId },
            { 
                $set: { 
                    'orderedItems.$[].status': 'Processing',
                    payment_status: 'completed',
                    paymentDetails: {
                        razorpayOrderId: payment.razorpay_order_id,
                        razorpayPaymentId: payment.razorpay_payment_id,
                        razorpaySignature: payment.razorpay_signature
                    }
                }
            },
            { new: true }
        );

        const cart = await Cart.findOne({ userId: userId });

        if (cart) {
            // Update the cart using the correct cart document
            await Cart.findOneAndUpdate(
                { userId: userId },
                { $set: { items: [] } }
            );
        }

      res.json({ success: true });

        

        if (!updatedOrder) {
            console.error('Failed to update order after payment verification');
            return res.status(500).json({ error: 'Failed to update order status' });
        }

       

    } catch (error) {
        console.error('Verify retry payment error:', error);
        res.status(500).json({ error: 'Failed to verify payment' });
    }
};

module.exports = {
    checkOutPage,
    checkOutAddress,
    createRazorpayOrder,
    verifyPayment,
    orderComform,
    postCheckout,
    applyCoupon,
    retryPayment,
    verifyRetryPayment
};
