import bcrypt from "bcrypt";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import Bid from "./Models/Bid.js";
import sellercarregistrationModel from "./Models/sellercarresgistration.js";
import { default as User, default as UserModel } from "./Models/User.js";
import AuthRouter from "./Routes/AuthRouter.js";
import BidRouter from "./Routes/Bid.js";
import ProductRouter from "./Routes/ProductRouter.js";
import CarRegistrationRouter from "./Routes/sellercarregistration.js";
import userprofieRouter from "./Routes/userprofile.js";
const stripe = new Stripe(
  "sk_test_51QYEXzRwAz4jWWzSUcRFevSpzT5ggoJLCvvAgZybZlfcuGO7lKvBjvPfRTgnVlPwpk5BH20yE9gq1xwSMGDcDUty00JA0dRhcZ"
);

import cron from "node-cron";

dotenv.config();

// Create Express app
const app = express();

// MongoDB connection URL
const url =
  "mongodb+srv://pyanda:1234@cluster0.wkpkr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Connect to MongoDB
mongoose
  .connect(url)
  .then(() => console.log("Connected to database"))
  .catch((err) => console.error("Database connection error:", err));

mongoose.set("strictQuery", true);

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api/carRegistration", CarRegistrationRouter);
app.use("/auth", AuthRouter);
app.use("/products", ProductRouter);
app.use("/api/bids", BidRouter);
app.use("/userprofile", userprofieRouter);

const transporter = nodemailer.createTransport({
  service: "gmail", // Use your email provider (e.g., Gmail, Outlook)
  auth: {
    user: "pyandakhanyt@gmail.com", // Your email
    pass: "mgedmoymxhzrqcnk", // Your email password or App Password
  },
});

// Send email function
const sendEmail = async (recipientEmail, subject, text) => {
  const mailOptions = {
    from: "Car Auction", // Sender email address
    to: recipientEmail, // Recipient email address (winner)
    subject: subject, // Email subject
    text: text, // Email body
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${recipientEmail}`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

cron.schedule("* * * * *", async () => {
  try {
    // Fetch cars where the bidding time has ended and bidding is not yet marked as ended
    const cars = await sellercarregistrationModel
      .find({
        biddingEndTime: { $lte: new Date() }, // Cars with bidding end time before now
        isBiddingEnded: false, // Only process cars that haven't been marked as ended
      })
      .populate("bids"); // Populate bids array with actual Bid documents

    for (let car of cars) {
      console.log("Bidding time ended for car ", car._id);

      // Ensure there are bids before proceeding
      if (car.bids.length === 0) {
        console.log(`No bids placed for car ${car._id}`);
        continue; // Skip this car if no bids are placed
      }

      // Find the highest bid for the car
      const highestBid = car.bids.reduce((max, bid) => {
        return bid.bid.amount > max.bid.amount ? bid : max;
      }, car.bids[0]);

      car.highestBid = highestBid._id;
      car.winner = highestBid.bid.bidder;
      car.isBiddingEnded = true;

      // Update the status of the highest bid to "Accepted" and others to "Rejected"
      await Promise.all(
        car.bids.map(async (bid) => {
          // Update bid status based on whether it's the highest bid
          const bidToUpdate = await Bid.findById(bid._id); // Fetch the actual Bid document
          if (bidToUpdate) {
            bidToUpdate.bid.status =
              bid._id.toString() === highestBid._id.toString()
                ? "Accepted"
                : "Sold out";
            await bidToUpdate.save(); // Save the updated bid status
          }
        })
      );
      car.status = "Sold out";
      // Save the updated car details with the highest bid, winner, and isBiddingEnded flag
      await car.save();
      const winner = await User.findById(highestBid.bid.bidder);
      if (winner && winner.email) {
        // Send email notification to the winner
        const subject = `Congratulations! You won the bid for ${car.make} ${car.brand}`;
        const text = `Dear ${winner.name},\n\nCongratulations! You have won the bid for the ${car.make} ${car.brand} with your bid of ${highestBid.bid.amount}.\n\nBest regards,\nCar Auction Platform`;
        await sendEmail(winner.email, subject, text);
      }

      console.log(`Highest bid for car ${car._id} is ${highestBid.bid.amount}`);
    }

    console.log("Checked and updated highest bids for cars.");
  } catch (error) {
    console.error("Error in scheduled task:", error);
  }
});

// In your Express routes file
app.put("/api/carRegistration/:id/acceptBid", async (req, res) => {
  try {
    const { id } = req.params;
    const { bidId } = req.body; // Ensure this is coming in the request body

    // Validate that both the car ID and bid ID are provided
    if (!id || !bidId) {
      return res.status(400).send("Car ID and Bid ID are required");
    }

    // Find the car
    const car = await sellercarregistrationModel.findById(id);
    if (!car) {
      return res.status(404).send("Car not found");
    }

    // Check if the bidId exists in the car's bids
    const bidExists = car.bids.some((bid) => bid._id.toString() === bidId);
    if (!bidExists) {
      return res.status(400).send("Bid not found");
    }

    // Update each bid's status
    const updatedBids = car.bids.map((bid) => {
      if (bid._id.toString() === bidId) {
        return { ...bid, status: "Pending Payment" }; // Accepted bid
      }
      return { ...bid, status: "Rejected" }; // Rejected bids
    });

    // Update the car with new bids status
    await sellercarregistrationModel.findByIdAndUpdate(
      id,
      { $set: { bids: updatedBids } },
      { new: true }
    );

    res.status(200).json({ message: "Bid accepted successfully" });
  } catch (error) {
    console.error("Error accepting bid:", error); // Log the error for debugging
    res.status(500).send("Internal Server Error");
  }
});

// Define the port
const PORT = process.env.PORT || 8080;

app.put("/profile", async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user.id; // Assuming authentication middleware sets req.user

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { name, email },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    res
      .status(200)
      .json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating profile", error: error.message });
  }
});

// Update user password
app.put("/userprofile", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Incorrect current password" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    console.log("Update user password successfully");
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating password", error: error.message });
  }
});

// Configure multer for avatar upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/avatars"); // Ensure this directory exists
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Upload user avatar
app.put("/api/user/avatar", upload.single("avatar"), async (req, res) => {
  try {
    const userId = req.user.id;
    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { avatar: avatarPath },
      { new: true }
    ).select("-password");

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    res
      .status(200)
      .json({ message: "Avatar uploaded successfully", avatar: avatarPath });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error uploading avatar", error: error.message });
  }
});

// Delete user profile
// app.delete('/api/user/profile', async (req, res) => {
//   try {
//     const userId = req.user._id;
//     await UserModel.findByIdAndDelete(userId);

//     res.status(200).json({ message: 'Profile deleted successfully' });
//   } catch (error) {
//     res.status(500).json({ message: 'Error deleting profile', error: error.message });
//   }
// });

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.post("/create-payment-intent", async (req, res) => {
  const { amount } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "pkr",
    });
    res.status(200).send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});
