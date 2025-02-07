const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET_KEY
});

const getWalletDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        let wallet = await Wallet.findOne({ userId });

        if (!wallet) {
            wallet = await new Wallet({ userId }).save();
        }

        return wallet;
    } catch (error) {
        console.error('Error getting wallet details:', error);
        throw error;
    }
};

const addMoneyToWallet = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.session.user;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount'
            });
        }

        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: amount * 100, // Convert to paise
            currency: 'INR',
            receipt: `wallet_${userId}_${Date.now()}`
        });

        res.json({
            success: true,
            order
        });

    } catch (error) {
        console.error('Error adding money to wallet:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing payment'
        });
    }
};

const verifyWalletPayment = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = req.body;
        const userId = req.session.user;

        // Verify payment signature here (implement your verification logic)
        // After verification:

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId });
        }

        // Add transaction
        wallet.transactions.push({
            userId,
            type: 'credit',
            amount: amount,
            description: 'Added money to wallet',
            balance: wallet.balance + amount
        });

        wallet.balance += amount;
        await wallet.save();

        res.json({
            success: true,
            message: 'Money added successfully',
            balance: wallet.balance
        });

    } catch (error) {
        console.error('Error verifying wallet payment:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying payment'
        });
    }
};

const getWalletHistory = async (req, res) => {
    try {
        const userId = req.session.user;
        const wallet = await Wallet.findOne({ userId });
        
        if (!wallet) {
            return [];
        }

        return wallet.transactions.sort((a, b) => b.date - a.date);
    } catch (error) {
        console.error('Error getting wallet history:', error);
        throw error;
    }
};

// Function to use wallet balance for payment or add refund
const useWalletBalance = async (userId, amount, description, type = 'debit') => {
    try {
        let wallet = await Wallet.findOne({ userId });
        
        // Create wallet if it doesn't exist
        if (!wallet) {
            wallet = await new Wallet({ userId, balance: 0 }).save();
        }

        // For debit, check if there's sufficient balance
        if (type === 'debit' && wallet.balance < amount) {
            return {
                success: false,
                message: 'Insufficient wallet balance'
            };
        }

        // Calculate new balance based on transaction type
        const newBalance = type === 'credit' 
            ? wallet.balance + amount 
            : wallet.balance - amount;

        wallet.transactions.push({
            userId,
            type,
            amount,
            description,
            balance: newBalance
        });

        wallet.balance = newBalance;
        await wallet.save();

        return {
            success: true,
            remainingBalance: wallet.balance
        };
    } catch (error) {
        console.error('Error processing wallet transaction:', error);
        throw error;
    }
};

module.exports = {
    getWalletDetails,
    addMoneyToWallet,
    verifyWalletPayment,
    getWalletHistory,
    useWalletBalance
};
