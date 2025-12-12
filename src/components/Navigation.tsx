import React from 'react';
import { Link } from 'react-router-dom';
import { FaUser, FaBook, FaCog, FaPlay, FaFileAlt } from 'react-icons/fa';

const Navigation: React.FC = () => {
  return (
    <nav className="bg-base-200 p-2 shadow-md">
      <div className="container mx-auto flex justify-center">
        <ul className="flex space-x-2">
          <li>
            <Link to="/main_window" className="btn btn-ghost btn-sm flex items-center space-x-1">
              <FaPlay />
              <span>Interview</span>
            </Link>
          </li>
          <li>
            <Link to="/knowledge" className="btn btn-ghost btn-sm flex items-center space-x-1">
              <FaBook />
              <span>Knowledge Base</span>
            </Link>
          </li>
          <li>
            <Link to="/resume-analysis" className="btn btn-ghost btn-sm flex items-center space-x-1">
              <FaFileAlt />
              <span>Resume Analysis</span>
            </Link>
          </li>
          <li>
            <Link to="/settings" className="btn btn-ghost btn-sm flex items-center space-x-1">
              <FaCog />
              <span>Settings</span>
            </Link>
          </li>
          <li>
            <Link to="/realtime-demo" className="btn btn-ghost btn-sm flex items-center space-x-1">
              <FaUser />
              <span>Real-Time Demo</span>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navigation;
