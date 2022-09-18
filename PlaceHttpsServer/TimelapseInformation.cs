//Credit: Optimisations & Refactor by StarlkYT
namespace PlaceHttpsServer;

internal sealed record TimelapseInformation
(
    string BackupStart,
    string BackupEnd,
    uint Fps,
    int StartX,
    int StartY,
    int EndX,
    int EndY,
    bool Reverse
);