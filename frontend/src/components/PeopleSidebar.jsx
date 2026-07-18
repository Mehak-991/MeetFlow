import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconButton, Menu, MenuItem, Collapse } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonAddAltIcon from "@mui/icons-material/PersonAddAlt";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import MoreVertIcon from "@mui/icons-material/MoreVert";

export default function PeopleSidebar({ isOpen, onClose, onAddPeople, username, videos }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [contributorsExpanded, setContributorsExpanded] = useState(true);

  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  const handleMenuOpen = (event, participant) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedParticipant(participant);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedParticipant(null);
  };

  const participants = [
    {
      id: "host",
      name: username ? `${username} (You)` : "You",
      role: "Meeting host",
      initials: username ? username.charAt(0).toUpperCase() : "Y"
    },
    ...videos.map(v => ({
      id: v.socketId,
      name: `Guest (${v.socketId.substring(0, 5)})`,
      role: "",
      initials: "G"
    }))
  ];

  const filteredParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          key="people-sidebar"
          initial={{ x: 390, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 390, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: "390px",
            height: "100vh",
            backgroundColor: "#202124",
            borderLeft: "1px solid #3C4043",
            borderTopLeftRadius: "24px",
            borderBottomLeftRadius: "24px",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            zIndex: 90,
            fontFamily: "'Google Sans', Inter, Roboto, sans-serif"
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "24px 24px 16px 24px",
          }}>
            <h2 style={{
              margin: 0,
              fontSize: "34px",
              fontWeight: 400,
              color: "#E8EAED"
            }}>
              People
            </h2>
            <IconButton
              onClick={onClose}
              sx={{
                color: "#E8EAED",
                "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.08)" }
              }}
            >
              <CloseIcon />
            </IconButton>
          </div>

          <div style={{ padding: "0 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Add People Button */}
            <button
              onClick={onAddPeople}
              style={{
                width: "100%",
                height: "52px",
                borderRadius: "999px",
                backgroundColor: "#0B57D0",
                color: "#FFFFFF",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "background-color 150ms"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1A73E8")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0B57D0")}
            >
              <PersonAddAltIcon fontSize="small" />
              Add people
            </button>

            {/* Search Bar */}
            <div style={{
              display: "flex",
              alignItems: "center",
              height: "52px",
              border: `1px solid ${isSearchFocused ? "#8AB4F8" : "#5F6368"}`,
              borderRadius: "12px",
              backgroundColor: "transparent",
              padding: "0 16px",
              gap: "12px",
              transition: "border-color 200ms ease",
              boxShadow: "none"
            }}>
              <SearchIcon sx={{ color: "#BDC1C6" }} />
              <input
                type="text"
                placeholder="Search for people"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#E8EAED",
                  fontSize: "14px",
                }}
              />
            </div>
          </div>

          {/* Section Label */}
          <div style={{ padding: "24px 24px 8px 24px" }}>
            <span style={{
              fontSize: "12px",
              fontWeight: 500,
              color: "#9AA0A6",
              textTransform: "uppercase",
              letterSpacing: "0.8px"
            }}>
              IN THE MEETING
            </span>
          </div>

          {/* Participants Scrollable Area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px 24px" }}>
            {/* Scrollbar styling injected globally or handled natively */}
            <style>
              {`
                ::-webkit-scrollbar {
                  width: 6px;
                }
                ::-webkit-scrollbar-track {
                  background: transparent; 
                }
                ::-webkit-scrollbar-thumb {
                  background: #5F6368; 
                  border-radius: 10px;
                }
                ::-webkit-scrollbar-thumb:hover {
                  background: #9AA0A6; 
                }
              `}
            </style>

            {/* Contributors Card */}
            <div style={{
              border: "1px solid #3C4043",
              borderRadius: "16px",
              backgroundColor: "transparent",
              overflow: "hidden"
            }}>
              <div
                onClick={() => setContributorsExpanded(!contributorsExpanded)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  height: "48px",
                  padding: "0 16px",
                  cursor: "pointer",
                  borderBottom: contributorsExpanded ? "1px solid #3C4043" : "none"
                }}
              >
                <span style={{ color: "#E8EAED", fontSize: "14px", fontWeight: 500 }}>
                  Contributors
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#9AA0A6" }}>
                  <span style={{ fontSize: "14px" }}>{filteredParticipants.length}</span>
                  {contributorsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </div>
              </div>

              <Collapse in={contributorsExpanded}>
                <div>
                  {filteredParticipants.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        height: "72px",
                        padding: "16px",
                        boxSizing: "border-box"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          backgroundColor: "#0B57D0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "18px",
                          fontWeight: 500,
                          color: "#FFFFFF"
                        }}>
                          {p.initials}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                          <span style={{ color: "#FFFFFF", fontSize: "14px", fontWeight: 500, lineHeight: "20px" }}>
                            {p.name}
                          </span>
                          {p.role && (
                            <span style={{ color: "#9AA0A6", fontSize: "12px", lineHeight: "16px" }}>
                              {p.role}
                            </span>
                          )}
                        </div>
                      </div>

                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, p)}
                        sx={{
                          width: "40px",
                          height: "40px",
                          backgroundColor: "transparent",
                          color: "#AECBFA",
                          "&:hover": { backgroundColor: "rgba(174, 203, 250, 0.08)" }
                        }}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </div>
                  ))}
                </div>
              </Collapse>
            </div>
          </div>

          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={handleMenuClose}
            PaperProps={{
              style: {
                backgroundColor: "#2B2C2F",
                color: "#E8EAED",
                boxShadow: "0px 4px 14px rgba(0,0,0,0.4)",
                borderRadius: "8px",
                padding: "4px 0",
                minWidth: "200px"
              }
            }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transitionDuration={200}
          >
            <MenuItem onClick={handleMenuClose} sx={{ fontSize: "14px", padding: "10px 20px", "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" } }}>Pin for everyone</MenuItem>
            <MenuItem onClick={handleMenuClose} sx={{ fontSize: "14px", padding: "10px 20px", "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" } }}>Pin for me</MenuItem>
            <MenuItem onClick={handleMenuClose} sx={{ fontSize: "14px", padding: "10px 20px", "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" } }}>Mute</MenuItem>
            <MenuItem onClick={handleMenuClose} sx={{ fontSize: "14px", padding: "10px 20px", "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" } }}>Remove from meeting</MenuItem>
            {selectedParticipant?.role !== "Meeting host" && (
              <MenuItem onClick={handleMenuClose} sx={{ fontSize: "14px", padding: "10px 20px", "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" } }}>Make host</MenuItem>
            )}
          </Menu>

        </motion.aside>
      )}
    </AnimatePresence>
  );
}
