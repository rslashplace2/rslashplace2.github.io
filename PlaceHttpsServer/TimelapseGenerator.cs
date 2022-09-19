//Credit: Optimisations & Refactor by StarlkYT
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace PlaceHttpsServer;

internal static class TimelapseGenerator
{
    private static readonly Rgba32[] Colours =
    {
        new(109, 0, 26), new(190, 0, 57), new(255, 69, 0), new(255, 168, 0),
        new(255, 214, 53), new(255, 248, 184), new(0, 163, 104), new(0, 204, 120),
        new(126, 237, 86), new(0, 117, 111), new(0, 158, 170), new(0, 204, 192),
        new(36, 80, 164), new(54, 144, 234), new(81, 233, 244), new(73, 58, 193),
        new(106, 92, 255), new(148, 179, 255), new(129, 30, 159), new(180, 74, 192),
        new(228, 171, 255), new(222, 16, 127), new(255, 56, 129), new(255, 153, 170),
        new (109, 72, 47), new(156, 105, 38), new(255, 180, 112), new(0, 0, 0),
        new(81, 82, 82), new(137, 141, 144), new(212, 215, 217), new(255, 255, 255)
    };

    private static readonly string CurrentDirectory = Directory.GetCurrentDirectory();

    public static async Task<byte[]> GenerateTimelapseAsync(string backupStart, string backupEnd, uint fps, int sizeX, int startX, int startY, int endX, int endY, bool reverse)
    {
        var backups =
            (await File.ReadAllLinesAsync(Path.Join(CurrentDirectory, "backuplist.txt")))
            .TakeWhile(backup => backup != backupEnd)
            .ToArray();

        if (reverse)
        {
            Array.Reverse(backups);
        }

        using var gif = new Image<Rgba32>(endX - startX, endY - startY);
        var inRange = false;
        
        foreach (var backup in backups)
        {
            if (!inRange)
            {
                inRange = backup == backupStart;
                continue;
            }
            
            var path = Path.Join(CurrentDirectory, backup);

            if (!File.Exists(path))
            {
                continue;
            }

            using var image = new Image<Rgba32>(endX - startX, endY - startY);
            image.Frames.RootFrame.Metadata.GetGifMetadata().FrameDelay = (int) (100 / fps);
            image.Frames.RootFrame.Metadata.GetGifMetadata().ColorTableLength = 32;

            var board = await File.ReadAllBytesAsync(path);
            var i = sizeX * startY + startX;
            
            while (i < board.Length)
            {
                image[(i % sizeX) - startX, (i / sizeX) - startY] = Colours[board[i]];
                i++;

                if (i % sizeX < endX)
                {
                    continue; // If we exceed width, go to next row, otherwise continue
                }

                if (i / sizeX == endY - 1)
                {
                    break; // If we exceed end bottom, we are done drawing this
                }
                
                i += sizeX - (endX - startX);
            }
            
            gif.Frames.AddFrame(image.Frames.RootFrame);
        }

        var memoryStream = new MemoryStream();
        memoryStream.Seek(0, SeekOrigin.Begin);
        await gif.SaveAsGifAsync(memoryStream);
        await memoryStream.FlushAsync();
        
        return memoryStream.ToArray();
    }
}