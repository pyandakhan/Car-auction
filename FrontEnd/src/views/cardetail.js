import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { placeBid } from "../Service/api";
import "./cardetails.css";
import Footer from "./footer1";
import Header from "./header";

export default function Cardetails() {
  const location = useLocation();
  const car = location.state?.car || {};
  const navigate = useNavigate();
  const [maxBidPKR, setMaxBidPKR] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);

  // Helper function to format time in hh:mm:ss
  const formatTime = (timeInSeconds) => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    console.log(car);
    if (car._id && car.biddingEndTime) {
      const fetchCarDetails = async () => {
        try {
          // Calculate initial time left in seconds
          const currentTime = new Date().getTime();
          const endTime = new Date(car.biddingEndTime).getTime();
          const initialTimeLeft = Math.floor((endTime - currentTime) / 1000); // Convert to seconds

          if (initialTimeLeft > 0) {
            setTimeLeft(initialTimeLeft);
          } else {
            setTimeLeft(0); // Bidding has already ended
            toast.error("Bidding has ended.");
            return;
          }

          // Update time left every second (countdown timer)
          const intervalId = setInterval(() => {
            setTimeLeft((prevTimeLeft) => {
              if (prevTimeLeft <= 1) {
                clearInterval(intervalId); // Stop countdown when time reaches 0
                return 0; // Stop the countdown at 0
              }
              return prevTimeLeft - 1; // Decrement time left by 1 second
            });
          }, 1000); // Updates every second

          // Cleanup interval on component unmount
          return () => clearInterval(intervalId);
        } catch (e) {
          console.error("Error processing car details:", e.message);
          toast.error("Failed to process car details. Please try again.");
        }
      };

      fetchCarDetails();
    }
  }, [car._id, car.biddingEndTime]); // Add dependencies to refetch if car details change

  const handleBidSubmit = async () => {
    try {
      const numericMaxBid = parseFloat(maxBidPKR); // Parse input to float
      const currentBid = parseFloat(car.estimatedvalue); // Convert estimated value to number

      if (!numericMaxBid || isNaN(numericMaxBid)) {
        toast.error("Please enter a valid numeric bid.");
        return;
      }

      if (numericMaxBid <= currentBid) {
        toast.error(
          `Your bid must be higher than the current bid of ${currentBid} PKR.`
        );
        return;
      }

      const response = await placeBid(car._id, numericMaxBid);

      toast.success("Bid placed successfully!");
      setMaxBidPKR("");
      navigate("/bidding");
    } catch (e) {
      console.error("Error placing bid:", e.message);
      toast.error("Failed to place bid. Please try again.");
    }
  };

  return (
    <div>
      <Header />
      <div className="flex flex-col md:flex-row p-6 gap-6">
        {/* Left side - Car details */}
        <div className="w-full md:w-2/3 bg-white shadow rounded-lg p-4">
          <h1 className="text-2xl font-bold mb-4">
            {`${car.make} ${car.brand} (${car.model})`}
          </h1>
          <div className="bg-gray-200 h-64 flex items-center justify-center mb-4">
            <img
              alt="Car"
              src={car.imageUrl || "/placeholder-image.jpg"}
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Vehicle Information</h2>
            <p>
              <strong>Model:</strong> {car.model}
            </p>
            <p>
              <strong>Brand:</strong> {car.brand}
            </p>
            <p>
              <strong>Make:</strong> {car.make}
            </p>
            <p>
              <strong>Chassis Number:</strong> {car.chassisNumber}
            </p>
            <p>
              <strong>Color:</strong> {car.color}
            </p>
            <p>
              <strong>Variant:</strong> {car.variant}
            </p>
            <p>
              <strong>Description:</strong> {car.detaildescription}
            </p>
          </div>
        </div>

        {/* Right side - Auction Information */}
        <div className="w-full md:w-1/3 bg-gray-100 shadow rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Auction Information</h2>
          <div className="mb-2 flex justify-between">
            <span>Current Bid:</span>
            <span className="font-bold">{car.estimatedvalue} PKR</span>
          </div>
          <div className="mb-2 flex justify-between">
            <span>Number of Bids:</span>
            <span className="font-bold">{car.bids?.length || 0}</span>
          </div>
          <div className="mb-2 flex justify-between">
            <span>Time Left:</span>
            <span className="font-bold">
              {timeLeft !== null ? formatTime(timeLeft) : "Loading..."}
            </span>
          </div>
          <h3 className="text-md font-semibold mt-4">Place Your Bid</h3>
          <p>Set up auto-bidding for this auction.</p>
          <input
            type="number"
            placeholder="Your Maximum Bid (PKR)"
            className="border w-full p-2 rounded mt-2"
            value={maxBidPKR}
            onChange={(e) => setMaxBidPKR(e.target.value)}
          />
          <button
            className="bg-green-500 text-white py-2 px-4 rounded mt-4 w-full"
            onClick={handleBidSubmit}
          >
            Place Bid Now
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
