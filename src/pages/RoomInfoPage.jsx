export default function RoomInfoPage({
  activeRoom,
  activeRoomImageUrl,
  activeRoomCanEdit,
  activeInfoSection,
  activeInfoLoading,
  activeInfoMembers = [],
  activeInfoRequests = [],
  inviteLinkLoading,
  generatedInviteLink,
  inviteLinkCopied,
  inviteLinkAutoAccept,
  setInviteLinkAutoAccept,
  copyGeneratedInviteLink,
  generatePrivateRoomInviteLink,
  approveJoinRequest,
  getInviteUserId,
  toggleActiveInfoSection,
  openEditRoomModal,
  isRoomOwner,
  userId,
  onClose,
}) {
  if (!activeRoom) return null;

  const ownerCheck =
    typeof isRoomOwner === 'function'
      ? isRoomOwner(activeRoom, userId)
      : activeRoom?.ownerId === userId || activeRoom?.createdBy === userId;

  return (
    <div
      className="active-room-info-shell"
      role="dialog"
      aria-modal="true"
      aria-label="Group information"
      onClick={onClose}
    >
      <section className="active-room-info-panel" onClick={(event) => event.stopPropagation()}>
        <div className="active-room-info-cover">
          {activeRoomImageUrl ? (
            <img src={activeRoomImageUrl} alt={activeRoom.name || 'Group'} />
          ) : (
            <span>{(activeRoom.name || 'G').slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        <div className="active-room-info-header">
          <div>
            <p className="active-room-info-kicker">Group info</p>
            <h2>{activeRoom.name}</h2>
            <p>
              {activeRoom.privacy === 'private' ? 'Private group' : 'Public group'}
              {activeRoom.memberCount ? ` · ${activeRoom.memberCount} members` : ''}
            </p>

            {ownerCheck && <span className="room-owner-badge">You created this</span>}
          </div>

          <button type="button" className="active-room-info-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="active-room-info-rows">
          <button
            type="button"
            className={`active-room-info-row ${activeInfoSection === 'members' ? 'open' : ''}`}
            onClick={() => toggleActiveInfoSection?.('members')}
          >
            Members
          </button>

          {activeRoomCanEdit && activeRoom.privacy === 'private' && (
            <button
              type="button"
              className={`active-room-info-row ${activeInfoSection === 'requests' ? 'open' : ''}`}
              onClick={() => toggleActiveInfoSection?.('requests')}
            >
              Requests
            </button>
          )}

          {activeRoomCanEdit && (
            <button
              type="button"
              className="active-room-info-row"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();

                if (!activeRoom?.roomId) return;

                openEditRoomModal?.(activeRoom);
              }}
            >
              Edit
            </button>
          )}

          {activeRoomCanEdit && activeRoom.privacy === 'private' && (
            <button
              type="button"
              className={`active-room-info-row ${activeInfoSection === 'invite' ? 'open' : ''}`}
              onClick={() => toggleActiveInfoSection?.('invite')}
            >
              Invite
            </button>
          )}
        </div>

        <div className="active-room-info-expanded-area">
          {activeInfoSection === 'members' && (
            <div className="active-room-info-inline-section">
              {activeInfoLoading ? (
                <p className="active-room-info-empty">Loading members...</p>
              ) : activeInfoMembers.length === 0 ? (
                <p className="active-room-info-empty">No members found.</p>
              ) : (
                activeInfoMembers.map((member) => {
                  const memberId = getInviteUserId?.(member) || '';
                  const memberIsCreator =
                    memberId &&
                    (memberId === activeRoom.ownerId || memberId === activeRoom.createdBy);

                  return (
                    <div className="active-room-info-person" key={memberId || member.email || member.userEmail}>
                      <div className="active-room-info-avatar">
                        {member.avatarUrl || member.photoUrl || member.profilePic ? (
                          <img src={member.avatarUrl || member.photoUrl || member.profilePic} alt="" />
                        ) : (
                          <span>
                            {(member.name || member.userName || member.email || 'U')
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div>
                        <strong>{member.name || member.userName || member.email || 'User'}</strong>
                        <p>{member.email || member.userEmail || member.role || 'Member'}</p>
                      </div>

                      <span className="member-role-pill">
                        {memberIsCreator ? 'Creator' : member.role || 'Member'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeInfoSection === 'requests' && activeRoomCanEdit && activeRoom.privacy === 'private' && (
            <div className="active-room-info-inline-section">
              {activeInfoLoading ? (
                <p className="active-room-info-empty">Loading requests...</p>
              ) : activeInfoRequests.length === 0 ? (
                <p className="active-room-info-empty">No pending requests.</p>
              ) : (
                activeInfoRequests.map((request) => {
                  const requestUserId = getInviteUserId?.(request) || '';

                  return (
                    <div
                      className="active-room-info-person request"
                      key={requestUserId || request.email || request.userEmail}
                    >
                      <div className="active-room-info-avatar">
                        {request.avatarUrl || request.photoUrl || request.profilePic ? (
                          <img src={request.avatarUrl || request.photoUrl || request.profilePic} alt="" />
                        ) : (
                          <span>
                            {(request.name || request.userName || request.email || 'U')
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div>
                        <strong>{request.name || request.userName || request.email || 'User'}</strong>
                        <p>
                          {request.source === 'inviteLink'
                            ? 'Requested through invite link'
                            : request.email || request.userEmail || 'Requested to join'}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="active-room-info-approve"
                        onClick={() => approveJoinRequest?.(requestUserId)}
                      >
                        Accept
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeInfoSection === 'invite' && activeRoomCanEdit && activeRoom.privacy === 'private' && (
            <div className="active-room-info-inline-section invite-link-inline">
              {inviteLinkLoading ? (
                <p className="active-room-info-empty">Generating invite link...</p>
              ) : generatedInviteLink ? (
                <>
                  <input value={generatedInviteLink} readOnly />
                  <button type="button" onClick={copyGeneratedInviteLink}>
                    {inviteLinkCopied ? 'Copied' : 'Copy link'}
                  </button>
                </>
              ) : (
                <>
                  <label className="invite-link-auto-accept-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(inviteLinkAutoAccept)}
                      onChange={(event) => setInviteLinkAutoAccept?.(event.target.checked)}
                      disabled={inviteLinkLoading || Boolean(generatedInviteLink)}
                    />

                    <div className="invite-link-auto-accept-content">
                      <div className="invite-link-auto-accept-header">
                        <span>Auto accept members</span>
                        <strong>{inviteLinkAutoAccept ? 'ON' : 'OFF'}</strong>
                      </div>

                      <small>
                        Users joining with this link will instantly enter the group without approval.
                      </small>
                    </div>
                  </label>

                  <button type="button" onClick={() => generatePrivateRoomInviteLink?.(activeRoom)}>
                    {inviteLinkAutoAccept ? 'Generate auto-join link' : 'Generate approval link'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
