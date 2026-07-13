import "./Footer.css";
import { useNavigate } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaTwitter, FaLinkedin, FaArrowRight } from "react-icons/fa";

export default function Footer() {
  const navigate = useNavigate();
  const handleNavigate = (path) => {
    navigate(path);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };

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
            <a href="https://www.facebook.com/share/1YEMvDGYew/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <FaFacebookF />
            </a>
            <a href="https://www.instagram.com/_examsarkar_/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <FaInstagram />
            </a>
            <a href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="X">
              <FaTwitter />
            </a>
            <a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <FaLinkedin />
            </a>
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
              <button type="button" onClick={() => handleNavigate("/test-series")}> 
                <FaArrowRight /> Tests
              </button>
            </li>
            <li>
              <button type="button" onClick={() => handleNavigate("/dashboard")}> 
                <FaArrowRight /> Dashboard
              </button>
            </li>
            <li>
              <button type="button" onClick={() => handleNavigate("/dashboard")}> 
                <FaArrowRight /> Results
              </button>
            </li>
            <li>
              <button type="button" onClick={() => handleNavigate("/contact")}> 
                <FaArrowRight /> Contact
              </button>
            </li>
          </ul>
        </div>

        {/* SUPPORT */}
        <div className="footer-links">
          <h3>POLICIES</h3>
          <ul>
          <li>
  <FaArrowRight />
  <a
    href="/legal/PRIVACY POLICY.pdf"
    target="_blank"
    rel="noopener noreferrer"
  >
    Privacy Policy
  </a>
</li>
<li>
  <FaArrowRight />
  <a
    href="/legal/TERMS AND CONDITIONS.pdf"
    target="_blank"
    rel="noopener noreferrer"
  >
  Terms and Conditions
  </a>
</li>
<li>
  <FaArrowRight />
  <a
    href="/legal/POLICY.pdf"
    target="_blank"
    rel="noopener noreferrer"
  >
  Policies
  </a>
</li>
<li>
  <FaArrowRight />
  <a
    href="/legal/REFUND POLICY.pdf"
    target="_blank"
    rel="noopener noreferrer"
  >
  Refund Policy
  </a>
</li>
<li>
  <FaArrowRight />
  <a
    href="/legal/DISCLAIMER POLICY.pdf"
    target="_blank"
    rel="noopener noreferrer"
  >
Disclaimer policies
  </a>
</li>
            
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