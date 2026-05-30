import React from 'react';
import { Mail, Phone, MessageSquare } from 'lucide-react';
import { FaInstagram, FaFacebook } from 'react-icons/fa';
import Navbar from '../../components/Navbar/Navbar';
import './ContactPage.css';

const ContactPage = ({ onLoginClick, onSignupClick, onHomeClick, onPlansClick }) => {
  return (
    <div className="contact-page-wrapper">
      <Navbar
        onSignupClick={onSignupClick}
        onLoginClick={onLoginClick}
        onHomeClick={onHomeClick}
        onPlansClick={onPlansClick}
      />

      <div className="contact-container">
        {/* Header */}
        <div className="contact-header">
          <div className="contact-badge">Support Center</div>
          <h1>Get in Touch with <span>ExamSarkar</span></h1>
          <p>Have questions about your preparation, test series, or account? Reach out through the channel that works best for you.</p>

          <div className="contact-highlights">
            <div className="highlight-chip">
              <span className="highlight-label">Email</span>
              <strong>Reply within 24 hours</strong>
            </div>
            <div className="highlight-chip">
              <span className="highlight-label">WhatsApp</span>
              <strong>Fast support during business hours</strong>
            </div>
            <div className="highlight-chip">
              <span className="highlight-label">Call</span>
              <strong>Mon-Fri, 10 AM - 6 PM IST</strong>
            </div>
          </div>
        </div>

        {/* Contact Methods Grid */}
        <div className="contact-grid">
          {/* Email */}
          <div className="contact-card">
            <div className="icon-wrapper email-icon">
              <Mail size={32} />
            </div>
            <h3>Email</h3>
            <p className="contact-value contact-value-email">helloexamsarkar@gmail.com</p>
            <a href="mailto:helloexamsarkar@gmail.com" className="contact-link">
              Send Email
            </a>
          </div>

          {/* Phone */}
          <div className="contact-card">
            <div className="icon-wrapper phone-icon">
              <Phone size={32} />
            </div>
            <h3>Phone</h3>
            <p className="contact-value">9606972603</p>
            <a href="tel:+919606972603" className="contact-link">
              Call Us
            </a>
          </div>

          {/* WhatsApp */}
          <div className="contact-card">
            <div className="icon-wrapper whatsapp-icon">
              <MessageSquare size={32} />
            </div>
            <h3>WhatsApp</h3>
            <p className="contact-value">Chat on WhatsApp</p>
            <a
              href="https://wa.me/message/WV3NA3BSVEBIG1"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-link"
            >
              Send Message
            </a>
          </div>

          {/* Instagram */}
          <div className="contact-card">
            <div className="icon-wrapper instagram-icon">
              <FaInstagram size={32} />
            </div>
            <h3>Instagram</h3>
            <p className="contact-value">@_examsarkar_</p>
            <a
              href="https://www.instagram.com/_examsarkar_"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-link"
            >
              Follow Us
            </a>
          </div>

          {/* Facebook */}
          <div className="contact-card">
            <div className="icon-wrapper facebook-icon">
              <FaFacebook size={32} />
            </div>
            <h3>Facebook</h3>
            <p className="contact-value">ExamSarkar</p>
            <a
              href="https://www.facebook.com/share/1YEMvDGYew/"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-link"
            >
              Visit Page
            </a>
          </div>
        </div>

        {/* Quick Info Section */}
        <div className="contact-info-section">
          <h2>Why Contact Us?</h2>
          <ul className="info-list">
            <li>Get help with your preparation journey</li>
            <li>Ask questions about our test series and plans</li>
            <li>Report technical issues or bugs</li>
            <li>Provide feedback and suggestions</li>
            <li>Join our community and stay updated</li>
          </ul>
        </div>

        {/* Response Time */}
        <div className="response-time">
          <p>📧 We typically respond to emails within 24 hours</p>
          <p>💬 WhatsApp messages are answered during business hours</p>
          <p>📱 Call us Monday-Friday, 10 AM - 6 PM IST</p>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
