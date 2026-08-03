// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BlueLedgerRegistry
/// @notice Hash-only blue-carbon registry intended for Polygon Amoy during the SIH prototype.
/// @dev Documents, imagery, GIS files and MRV reports remain off-chain.
contract BlueLedgerRegistry {
    enum CreditStatus {
        None,
        Draft,
        PendingVerification,
        Issued,
        Transferred,
        Retired,
        Cancelled
    }

    struct ProjectAnchor {
        bytes32 approvalHash;
        bytes32 boundaryHash;
        bool areaCleared;
        uint64 registeredAt;
    }

    struct ReportAnchor {
        bytes32 reportHash;
        bytes32 evidenceBundleHash;
        bytes32 verificationDecisionHash;
        uint64 anchoredAt;
    }

    struct CreditBatch {
        bytes32 projectId;
        bytes32 periodKey;
        bytes32 reportHash;
        uint256 quantity;
        address holder;
        CreditStatus status;
    }

    address public owner;
    mapping(address => bool) public verifiers;
    mapping(bytes32 => ProjectAnchor) public projects;
    mapping(bytes32 => ReportAnchor) public reports;
    mapping(bytes32 => CreditBatch) public batches;
    mapping(bytes32 => mapping(bytes32 => bool)) public periodIssued;

    event VerifierUpdated(address indexed verifier, bool enabled);
    event ProjectRegistered(
        bytes32 indexed projectId,
        bytes32 approvalHash,
        bytes32 boundaryHash,
        uint256 timestamp
    );
    event MRVReportAnchored(
        bytes32 indexed projectId,
        bytes32 indexed periodKey,
        bytes32 reportHash,
        bytes32 evidenceBundleHash,
        bytes32 verificationDecisionHash,
        uint256 timestamp
    );
    event CreditsIssued(
        bytes32 indexed batchId,
        bytes32 indexed projectId,
        bytes32 indexed periodKey,
        bytes32 reportHash,
        uint256 quantity,
        address holder,
        uint256 timestamp
    );
    event CreditsTransferred(
        bytes32 indexed batchId,
        address indexed from,
        address indexed to,
        uint256 quantity,
        uint256 timestamp
    );
    event CreditsRetired(
        bytes32 indexed batchId,
        address indexed holder,
        uint256 quantity,
        bytes32 retirementReasonHash,
        uint256 timestamp
    );
    event CreditsCancelled(bytes32 indexed batchId, bytes32 reasonHash, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "owner only");
        _;
    }

    modifier onlyVerifier() {
        require(verifiers[msg.sender], "verifier only");
        _;
    }

    constructor(address initialVerifier) {
        owner = msg.sender;
        verifiers[msg.sender] = true;
        if (initialVerifier != address(0)) verifiers[initialVerifier] = true;
    }

    function setVerifier(address verifier, bool enabled) external onlyOwner {
        verifiers[verifier] = enabled;
        emit VerifierUpdated(verifier, enabled);
    }

    function registerProject(
        bytes32 projectId,
        bytes32 approvalHash,
        bytes32 boundaryHash,
        bool areaCleared
    ) external onlyVerifier {
        require(projects[projectId].registeredAt == 0, "project already registered");
        require(approvalHash != bytes32(0), "approval hash required");
        require(boundaryHash != bytes32(0), "boundary hash required");
        require(areaCleared, "overlapping area not cleared");
        projects[projectId] = ProjectAnchor(
            approvalHash,
            boundaryHash,
            true,
            uint64(block.timestamp)
        );
        emit ProjectRegistered(projectId, approvalHash, boundaryHash, block.timestamp);
    }

    function anchorMRVReport(
        bytes32 projectId,
        bytes32 periodKey,
        bytes32 reportHash,
        bytes32 evidenceBundleHash,
        bytes32 verificationDecisionHash
    ) external onlyVerifier {
        require(projects[projectId].registeredAt != 0, "project not registered");
        require(reportHash != bytes32(0), "report hash required");
        bytes32 reportKey = keccak256(abi.encode(projectId, periodKey));
        require(reports[reportKey].anchoredAt == 0, "period report already anchored");
        reports[reportKey] = ReportAnchor(
            reportHash,
            evidenceBundleHash,
            verificationDecisionHash,
            uint64(block.timestamp)
        );
        emit MRVReportAnchored(
            projectId,
            periodKey,
            reportHash,
            evidenceBundleHash,
            verificationDecisionHash,
            block.timestamp
        );
    }

    function issueCredits(
        bytes32 batchId,
        bytes32 projectId,
        bytes32 periodKey,
        uint256 quantity,
        address recipient
    ) external onlyVerifier {
        ProjectAnchor memory project = projects[projectId];
        require(project.registeredAt != 0 && project.areaCleared, "project not eligible");
        require(!periodIssued[projectId][periodKey], "period already issued");
        require(batches[batchId].status == CreditStatus.None, "batch already exists");
        bytes32 reportKey = keccak256(abi.encode(projectId, periodKey));
        ReportAnchor memory report = reports[reportKey];
        require(report.anchoredAt != 0, "MRV report not anchored");
        require(report.verificationDecisionHash != bytes32(0), "verification required");
        require(quantity > 0, "quantity required");
        require(recipient != address(0), "recipient required");
        periodIssued[projectId][periodKey] = true;
        batches[batchId] = CreditBatch(
            projectId,
            periodKey,
            report.reportHash,
            quantity,
            recipient,
            CreditStatus.Issued
        );
        emit CreditsIssued(
            batchId,
            projectId,
            periodKey,
            report.reportHash,
            quantity,
            recipient,
            block.timestamp
        );
    }

    function transferCredits(bytes32 batchId, address recipient) external {
        CreditBatch storage batch = batches[batchId];
        require(
            batch.status == CreditStatus.Issued || batch.status == CreditStatus.Transferred,
            "batch is not transferable"
        );
        require(batch.holder == msg.sender, "holder only");
        require(recipient != address(0), "recipient required");
        address previousHolder = batch.holder;
        batch.holder = recipient;
        batch.status = CreditStatus.Transferred;
        emit CreditsTransferred(batchId, previousHolder, recipient, batch.quantity, block.timestamp);
    }

    function retireCredits(bytes32 batchId, bytes32 retirementReasonHash) external {
        CreditBatch storage batch = batches[batchId];
        require(
            batch.status == CreditStatus.Issued || batch.status == CreditStatus.Transferred,
            "batch is not retireable"
        );
        require(batch.holder == msg.sender, "holder only");
        batch.status = CreditStatus.Retired;
        emit CreditsRetired(
            batchId,
            msg.sender,
            batch.quantity,
            retirementReasonHash,
            block.timestamp
        );
    }

    function cancelCredits(bytes32 batchId, bytes32 reasonHash) external onlyVerifier {
        CreditBatch storage batch = batches[batchId];
        require(batch.status == CreditStatus.Issued, "batch is not cancellable");
        batch.status = CreditStatus.Cancelled;
        emit CreditsCancelled(batchId, reasonHash, block.timestamp);
    }
}
