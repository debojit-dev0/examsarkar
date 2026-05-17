import "./Footer.css";
import { useNavigate } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaTwitter, FaLinkedin, FaArrowRight } from "react-icons/fa";

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="footer-section">

      <div className="footer-container">

        {/* BRAND SECTION */}
        <div className="footer-brand">
          <h2>EXAM SARKAR</h2>
          <p>
            Built for serious aspirants who want clarity, structure, and results.
          </p>

          {/* SOCIAL ICONS */}
          <div className="footer-socials">
            <FaFacebookF />
            <FaInstagram />
            <FaTwitter />
            <FaLinkedin />
          </div>
        </div>

        {/* QUICK LINKS */}
        <div className="footer-links">
          <h3>Quick Links</h3>
          <ul>
            <li>
              <button type="button" onClick={() => navigate("/")}> 
                <FaArrowRight /> Home
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate("/test-series")}> 
                <FaArrowRight /> Tests
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate("/dashboard")}> 
                <FaArrowRight /> Dashboard
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate("/dashboard")}> 
                <FaArrowRight /> Results
              </button>
            </li>
          </ul>
        </div>

        {/* SUPPORT */}
        <div className="footer-links">
          <h3>Support</h3>
          <ul>
            <li><FaArrowRight /> Help Center</li>
            <li><FaArrowRight /> Privacy Policy</li>
            <li><FaArrowRight /> Terms</li>
            <li><FaArrowRight /> Contact</li>
          </ul>
        </div>

      </div>

      {/* BOTTOM BAR */}
      <div className="footer-bottom">
        <p>© 2026 EXAM SARKAR. All Rights Reserved.</p>
      </div>

    </footer>
  );
}