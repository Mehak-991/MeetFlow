import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AiOutlineLock } from "react-icons/ai";
import { FiZap } from "react-icons/fi";
import { HiOutlineVideoCamera, HiOutlineChatBubbleLeftRight } from "react-icons/hi2";
import { MdDevices, MdCloudQueue, MdLightMode, MdDarkMode } from "react-icons/md";
import { useTheme } from "../contexts/ThemeContext";
import "../App.css";

export default function LandingPage() {
  const router = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const { darkMode, toggleTheme } = useTheme();

  // Detect scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) setScrolled(true);
      else setScrolled(false);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="landingPageContainer"
      style={{
        fontFamily: "'Poppins', sans-serif",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: darkMode ? "#0a0a0a" : "#FBFBFB",
        color: darkMode ? "#e0e0e0" : "#333",
        transition: "all 0.3s ease",
      }}
    >
      {/* Floating Image Animation CSS */}
      <style>
        {`
          @keyframes floatImg {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0px); }
          }
        `}
      </style>

      <nav
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 70px",
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,

          // Transparent at top, blur on scroll
          backgroundColor: scrolled
            ? (darkMode ? "rgba(10,10,10,0.85)" : "rgba(255,255,255,0.85)")
            : "transparent",
          backdropFilter: scrolled ? "blur(15px)" : "none",
          boxShadow: scrolled ? "0 2px 15px rgba(0,0,0,0.15)" : "none",

          transition: "all 0.3s ease",
        }}
      >
        {/* LOGO */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src="/erasebg-transformed (1).png"
            alt="MeetFlow"
            style={{
              height: "120px",
              width: "auto",
              cursor: "pointer",
              transition: "0.2s",
            }}
          />
        </div>

        {/* NAVIGATION LINKS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "32px",
            fontSize: "16px",
            fontWeight: "500",
          }}
        >
          {/* THEME TOGGLE */}
          <div
            onClick={toggleTheme}
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
              color: darkMode ? "#e0e0e0" : "#333",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#018CCB";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = darkMode ? "#e0e0e0" : "#333";
            }}
          >
            {darkMode ? <MdLightMode size={24} /> : <MdDarkMode size={24} />}
          </div>

          <p
            onClick={() => router("/aljk23")}
            style={{
              margin: 0,
              cursor: "pointer",
              color: darkMode ? "#e0e0e0" : "#333",
              transition: "0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.color = "#018CCB")}
            onMouseLeave={(e) => (e.target.style.color = darkMode ? "#e0e0e0" : "#333")}
          >
            Join as Guest
          </p>

          <p
            onClick={() => router("/auth?mode=signup")}
            style={{
              margin: 0,
              cursor: "pointer",
              color: darkMode ? "#e0e0e0" : "#333",
              transition: "0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.color = "#018CCB")}
            onMouseLeave={(e) => (e.target.style.color = darkMode ? "#e0e0e0" : "#333")}
          >
            Register
          </p>

          {/* LOGIN BUTTON */}
          <div
            onClick={() => router("/auth")}
            style={{
              backgroundColor: "#018CCB",
              padding: "10px 28px",
              borderRadius: "10px",
              color: "white",
              cursor: "pointer",
              fontWeight: "600",
              boxShadow: "0 4px 10px rgba(1,140,203,0.25)",
              transition: "all 0.25s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(1,140,203,0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 10px rgba(1,140,203,0.25)";
            }}
          >
            Login
          </div>
        </div>
      </nav>


      {/* HERO SECTION */}
      {/* HERO SECTION */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "140px 80px 80px",
          gap: "60px",
          minHeight: "100vh",
        }}
      >
        {/* LEFT TEXT */}
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontSize: "3.1rem",
              lineHeight: "1.1",
              fontWeight: "800",
              marginBottom: "18px",
              textTransform: "uppercase",
              letterSpacing: "-1px",
              color: darkMode ? "#ffffff" : "#1a1a1a",
            }}
          >
            CONNECT INSTANTLY,
            <br />
            FROM ANYWHERE
          </h1>

          <p
            style={{
              fontSize: "15px",
              color: "#777",
              marginBottom: "30px",
              lineHeight: "1.6",
              maxWidth: "420px",
            }}
          >
            Experience high-quality, secure video meetings with just one click.
            No downloads, no complications — simply join and start talking.
          </p>

          {/* CTA BUTTON */}
          <div
            role="button"
            style={{
              backgroundColor: "#018CCB",
              color: "white",
              padding: "14px 40px",
              borderRadius: "30px",
              fontWeight: "700",
              display: "inline-block",
              transition: "all 0.3s ease",
              textTransform: "uppercase",
              fontSize: "15px",
              letterSpacing: "0.6px",
              marginBottom: "16px",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#0179B0")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#018CCB")}
          >
            <Link to={"/auth?mode=signup"} style={{ color: "white", textDecoration: "none" }}>
              Get Started
            </Link>
          </div>

          <p
            style={{
              fontSize: "14px",
              color: darkMode ? "#aaa" : "#666",
              lineHeight: "1.6",
              maxWidth: "420px",
            }}
          >
            Get Started to begin your meeting. You can also choose Join as Guest or Login/Register.
          </p>
        </div>

        {/* RIGHT FLOATING IMAGE */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <img
            src="/erasebg-transformed.png"
            alt="Video Call Illustration"
            style={{
              maxWidth: "85%",
              height: "auto",
              borderRadius: "20px",
              animation: "floatImg 3s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* FEATURES SECTION */}
      <div
        style={{
          padding: "60px 100px",
          backgroundColor: darkMode ? "#0a0a0a" : "rgba(255,255,255,0.5)",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: "2.4rem",
            fontWeight: "700",
            marginBottom: "40px",
            marginTop: "40px",
            color: darkMode ? "#ffffff" : "#1a1a1a",
          }}
        >
          Why Choose MeetFlow?
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "28px",
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          {[
            {
              icon: <AiOutlineLock size={42} color="#018CCB" />,
              title: "Secure Calls",
              desc: "End-to-end encrypted meetings that keep your conversations private.",
            },
            {
              icon: <FiZap size={42} color="#018CCB" />,
              title: "Instant Join",
              desc: "Create or join meetings in seconds—no login or installation required.",
            },
            {
              icon: <HiOutlineVideoCamera size={42} color="#018CCB" />,
              title: "HD Quality",
              desc: "Crystal-clear video and audio for smooth conversation.",
            },
            {
              icon: <MdDevices size={42} color="#018CCB" />,
              title: "Works on Any Device",
              desc: "Fully optimized for mobile, tablet, laptop and desktop.",
            },
          ].map((feature, idx) => (
            <div
              key={idx}
              style={{
                background: darkMode ? "#1a1a1a" : "white",
                padding: "28px",
                borderRadius: "16px",
                textAlign: "left",
                boxShadow: darkMode ? "0 4px 12px rgba(0,0,0,0.3)" : "0 4px 12px rgba(0,0,0,0.07)",
                transition: "all 0.3s ease",
                cursor: "pointer",
                border: darkMode ? "1px solid #333" : "1px solid #f0f0f0",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow = "0 12px 25px rgba(0,0,0,0.10)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.07)";
              }}
            >
              <div style={{ marginBottom: "18px" }}>{feature.icon}</div>

              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  marginBottom: "10px",
                  color: darkMode ? "#ffffff" : "#1a1a1a",
                }}
              >
                {feature.title}
              </h3>

              <p style={{ fontSize: "14px", color: darkMode ? "#aaa" : "#555", lineHeight: "1.6" }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS SECTION */}
      <div
        style={{
          padding: "80px 100px",
          backgroundColor: darkMode ? "#0f0f0f" : "#FBFBFB",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: "2.4rem",
            fontWeight: "700",
            marginBottom: "20px",
            color: darkMode ? "#ffffff" : "#1a1a1a",
          }}
        >
          How It Works
        </h2>
        <p
          style={{
            textAlign: "center",
            fontSize: "16px",
            color: darkMode ? "#aaa" : "#666",
            marginBottom: "50px",
            maxWidth: "600px",
            margin: "0 auto 50px",
          }}
        >
          Get started in three simple steps. No complexity, just seamless video calling.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "40px",
            maxWidth: "1100px",
            margin: "0 auto",
          }}
        >
          {[
            {
              step: "01",
              title: "Create or Join",
              desc: "Start a new meeting or enter an existing room code",
            },
            {
              step: "02",
              title: "Share the Link",
              desc: "Copy and send the meeting link to your participants",
            },
            {
              step: "03",
              title: "Start Calling",
              desc: "Connect instantly with HD video and crystal-clear audio",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                flex: 1,
                textAlign: "center",
                position: "relative",
              }}
            >
              {/* Step Number Circle */}
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #018CCB, #0179B0)",
                  color: "white",
                  fontSize: "28px",
                  fontWeight: "800",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 25px",
                  boxShadow: "0 6px 20px rgba(1, 140, 203, 0.3)",
                }}
              >
                {item.step}
              </div>

              {/* Arrow between steps (except last) */}
              {idx < 2 && (
                <div
                  style={{
                    position: "absolute",
                    top: "40px",
                    right: "-40px",
                    fontSize: "32px",
                    color: "#018CCB",
                    fontWeight: "300",
                  }}
                >
                  →
                </div>
              )}

              <h3
                style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  marginBottom: "12px",
                  color: darkMode ? "#ffffff" : "#1a1a1a",
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  fontSize: "15px",
                  color: darkMode ? "#aaa" : "#666",
                  lineHeight: "1.6",
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* KEY FEATURES GRID */}
      <div
        style={{
          padding: "80px 100px",
          backgroundColor: darkMode ? "#0a0a0a" : "white",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: "2.4rem",
            fontWeight: "700",
            marginBottom: "20px",
            color: darkMode ? "#ffffff" : "#1a1a1a",
          }}
        >
          Everything You Need
        </h2>
        <p
          style={{
            textAlign: "center",
            fontSize: "16px",
            color: darkMode ? "#aaa" : "#666",
            marginBottom: "50px",
          }}
        >
          Powerful features designed for modern communication
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "30px",
            maxWidth: "1100px",
            margin: "0 auto",
          }}
        >
          {[
            {
              icon: <AiOutlineLock size={36} color="#018CCB" />,
              title: "End-to-end Encryption",
              desc: "Your conversations stay private with military-grade security",
            },
            {
              icon: <FiZap size={36} color="#018CCB" />,
              title: "1-Click Join",
              desc: "No account needed. Just click and you're in",
            },
            {
              icon: <HiOutlineVideoCamera size={36} color="#018CCB" />,
              title: "HD Video & Audio",
              desc: "Experience crystal-clear quality every time",
            },
            {
              icon: <MdDevices size={36} color="#018CCB" />,
              title: "Works on All Devices",
              desc: "Desktop, mobile, or tablet—works everywhere",
            },
            {
              icon: <HiOutlineChatBubbleLeftRight size={36} color="#018CCB" />,
              title: "Real-time Chat",
              desc: "Send messages during calls without interruption",
            },
            {
              icon: <MdCloudQueue size={36} color="#018CCB" />,
              title: "Cloud-based, No Downloads",
              desc: "Access from any browser, nothing to install",
            },
          ].map((feature, idx) => (
            <div
              key={idx}
              style={{
                background: darkMode ? "#1a1a1a" : "#FBFBFB",
                padding: "32px 24px",
                borderRadius: "12px",
                textAlign: "center",
                border: darkMode ? "1px solid #333" : "1px solid #e8e8e8",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#018CCB";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(1, 140, 203, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e8e8e8";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ marginBottom: "18px" }}>{feature.icon}</div>
              <h4
                style={{
                  fontSize: "17px",
                  fontWeight: "600",
                  marginBottom: "10px",
                  color: darkMode ? "#ffffff" : "#1a1a1a",
                }}
              >
                {feature.title}
              </h4>
              <p style={{ fontSize: "14px", color: darkMode ? "#aaa" : "#666", lineHeight: "1.5" }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* SCREENSHOTS SECTION */}
      <div
        style={{
          padding: "80px 100px",
          backgroundColor: darkMode ? "#0f0f0f" : "#FBFBFB",
          "--card-bg": darkMode ? "#1a1a1a" : "white",
          "--card-title": darkMode ? "#ffffff" : "#1a1a1a",
          "--card-text": darkMode ? "#aaa" : "#666",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: "2.4rem",
            fontWeight: "700",
            marginBottom: "20px",
            color: darkMode ? "#ffffff" : "#1a1a1a",
          }}
        >
          See It In Action
        </h2>
        <p
          style={{
            textAlign: "center",
            fontSize: "16px",
            color: darkMode ? "#aaa" : "#666",
            marginBottom: "50px",
            maxWidth: "600px",
            margin: "0 auto 50px",
          }}
        >
          Experience the simplicity and power of MeetFlow
        </p>

        <div className="screenshot-grid">
          {/* Screenshot 1 - Homepage */}
          <div className="screenshot-card">
            <img src="/screenshots/image.png" alt="Homepage" />
            <div className="screenshot-caption">
              <h4>Get Started Easily</h4>
              <p>On the homepage, click Get Started to begin your meeting. You can also choose Join as Guest or Login/Register.</p>
            </div>
          </div>

          {/* Screenshot 2 - Sign In/Sign Up */}
          <div className="screenshot-card">
            <img src="/screenshots/Screenshot 2025-12-04 205129.png" alt="Sign In/Sign Up" />
            <div className="screenshot-caption">
              <h4>Sign In or Create Account</h4>
              <p>On this screen, you can either sign in to your MeetFlow account or create a new one.</p>
              <p><strong>If you already have an account:</strong><br />Enter your email and password, then click Sign In to continue.</p>
              <p><strong>If you're new:</strong><br />Click Sign Up to create your account in just a few seconds.</p>
            </div>
          </div>

          {/* Screenshot 3 - Start or Join Meeting */}
          <div className="screenshot-card">
            <img src="/screenshots/Screenshot 2025-12-04 205530.png" alt="Start or Join Meeting" />
            <div className="screenshot-caption">
              <h4>Start or Join a Meeting</h4>
              <p>MeetFlow lets you instantly connect with anyone — your way.</p>
              <p><strong>Host a Meeting:</strong><br />Create your own meeting code and share it with others to start a new video call.</p>
              <p><strong>Join a Meeting:</strong><br />Already have a meeting code? Simply enter the code and click JOIN to join the ongoing call.</p>
            </div>
          </div>

          {/* Screenshot 4 - Steps to Join */}
          <div className="screenshot-card">
            <img src="/screenshots/Gemini_Generated_Image_evf7rdevf7rdevf7.png" alt="Steps to Join" />
            <div className="screenshot-caption">
              <h4>Steps to Join</h4>
              <p>• Allow camera & mic<br />• Check your preview<br />• Enter your name<br />• Click CONNECT</p>
            </div>
          </div>

          {/* Screenshot 5 - You're Now in the Meeting */}
          <div className="screenshot-card">
            <img src="/screenshots/image12.png" alt="You're Now in the Meeting" />
            <div className="screenshot-caption">
              <h4>You're Now in the Meeting</h4>
              <p>You've successfully joined the call.</p>
              <p>• Use the toolbar below to toggle camera, mic, screen share, and chat.<br />• Copy the meeting code to invite others.<br />• Send messages using the chat panel on the left.</p>
              <p>That's it — you're ready to talk!</p>
            </div>
          </div>

          {/* Screenshot 6 - Use Meeting Tools */}
          <div className="screenshot-card">
            <img src="/screenshots/final0mage.png" alt="Use Meeting Tools" />
            <div className="screenshot-caption">
              <h4>Use Meeting Tools</h4>
              <p>Inside the meeting, you can use all essential tools:</p>
              <p>• <strong>Chat Panel:</strong> Send and receive messages with participants.<br />• <strong>Copy Code:</strong> Share your meeting code to invite others.<br />• <strong>Camera Toggle:</strong> Turn your video on/off.<br />• <strong>Mic Toggle:</strong> Mute or unmute yourself.<br />• <strong>Screen Share:</strong> Present your screen.<br />• <strong>End Call:</strong> Leave the meeting anytime.</p>
              <p>Everything you need is available right in the bottom control bar.</p>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer
        style={{
          padding: "40px 100px",
          backgroundColor: "#1a1a1a",
          color: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            maxWidth: "1200px",
            margin: "0 auto",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          {/* Left - Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img
              src="/erasebg-transformed (1).png"
              alt="MeetFlow Logo"
              style={{ height: "40px", width: "auto" }}
            />
          </div>

          {/* Center - Links */}
          <div
            style={{
              display: "flex",
              gap: "30px",
              fontSize: "15px",
            }}
          >
            <a
              href="#/"
              style={{
                color: "#ccc",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.color = "#018CCB")}
              onMouseLeave={(e) => (e.target.style.color = "#ccc")}
            >
              About
            </a>
            <a
              href="#/"
              style={{
                color: "#ccc",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.color = "#018CCB")}
              onMouseLeave={(e) => (e.target.style.color = "#ccc")}
            >
              Contact
            </a>
            <a
              href="#/"
              style={{
                color: "#ccc",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.color = "#018CCB")}
              onMouseLeave={(e) => (e.target.style.color = "#ccc")}
            >
              Privacy
            </a>
            <a
              href="#/"
              style={{
                color: "#ccc",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.color = "#018CCB")}
              onMouseLeave={(e) => (e.target.style.color = "#ccc")}
            >
              Terms
            </a>
            <a
              href="#/"
              style={{
                color: "#ccc",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.color = "#018CCB")}
              onMouseLeave={(e) => (e.target.style.color = "#ccc")}
            >
              Help
            </a>
          </div>

          {/* Right - Copyright */}
          <div style={{ fontSize: "14px", color: "#999" }}>
            © {new Date().getFullYear()} MeetFlow. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
