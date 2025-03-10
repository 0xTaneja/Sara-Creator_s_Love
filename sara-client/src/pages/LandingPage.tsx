import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Link } from "react-router-dom";

const LandingPage = () => {
  const fullText = "hi, i'm sara";
  const [displayText, setDisplayText] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < fullText.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => fullText.slice(0, index + 1)); // Ensure correct slicing
        setIndex(index + 1);
      }, 200); // Adjust speed of animation

      return () => clearTimeout(timeout); // Cleanup timeout
    }
  }, [index, fullText]);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="relative flex-grow bg-white text-black flex flex-col items-center justify-center font-sans">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{
            backgroundImage:
              "url('https://source.unsplash.com/1920x1080/?technology,futuristic,minimal')",
          }}
        ></div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Sara Logo */}
          <img
            src="/Sara.jpg" // Ensure the logo is in the public folder
            alt="Sara Logo"
            className="w-40 h-40 rounded-full object-cover shadow-lg mb-4"
          />

          {/* Title with Typewriter Animation */}
          <h1 className="text-6xl font-extrabold text-pink-500 tracking-wide">
            {displayText}
          </h1>

          {/* Subheading */}
          <p className="mt-3 text-gray-600 text-lg max-w-xl">
            An AI-driven market maker that powers the creator economy.
          </p>

          {/* Wallet Address */}
          <div className="bg-gray-100 border border-gray-300 mt-6 px-6 py-3 rounded-lg relative">
            <span className="text-gray-600 text-sm truncate">
              0x8hVzPgFoqEQmNNoghr5WbPY1LEjW8GZgbLRwuwHpump
            </span>
            <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
              Token Soon 🚀
            </div>
          </div>

          {/* Explore Button (Centered) */}
          <div className="mt-8">
            <Link to="/home" className="px-6 py-3 bg-pink-500 text-white text-lg font-semibold rounded-full shadow-lg hover:bg-pink-600 transition-all">
              Explore
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default LandingPage;
