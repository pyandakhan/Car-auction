import mongoose from "mongoose";

const bidSchema = new mongoose.Schema({
  bid: {
    carid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CarInformation",
    },
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    amount: Number,
    date: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["Accepted", "Sold out", "Pending"],
      default: "Pending",
    },
  },
});

// Ensure 'amount' field is used for bid value
const Bid = mongoose.model("Bid", bidSchema);
export default Bid;
