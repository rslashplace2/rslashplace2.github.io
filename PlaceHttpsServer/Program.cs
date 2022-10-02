using System.Text;
using PlaceHttpsServer;

var configFile = Path.Join(Directory.GetCurrentDirectory(), "config.txt");
if (!File.Exists(configFile))
{
        File.WriteAllText(configFile, "cert: " + Environment.NewLine + "key: " + Environment.NewLine + "port: " + Environment.NewLine + "use_https: ");
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("Config created! Please check {0} and run this program again!", configFile);
        Console.ResetColor();
        Environment.Exit(0);
}

var config = File.ReadAllLines(configFile).Select(line => { line = line.Split(": ")[1]; return line; }).ToArray();

var builder = WebApplication.CreateBuilder(args);
builder.Configuration["Kestrel:Certificates:Default:Path"] = config[0];
builder.Configuration["Kestrel:Certificates:Default:KeyPath"] = config[1];
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("https://rplace.tk", "*");
    });
});

var app = builder.Build();
app.Urls.Add($"{(bool.Parse(config[3]) ? "https" : "http")}://*:{int.Parse(config[2])}");
app.UseCors(policy => policy.AllowAnyMethod().AllowAnyHeader().SetIsOriginAllowed(_ => true).AllowCredentials());

const string backuplistTemplate = @"
        <h1>rPlace canvas place file/backup list.</h1>
        <p>See [domain-url]/backuplist.txt for cleanly formatted list of backups saved here.</p>
        <span style=""color: red;"">(Do not try to iterate directly through this directory with code, for the sake of your own sanity, please instead use the plaintext list at /backuplist instead.)</span>
        <br> <br>
        <input type=""text"" placeholder=""Search.."" onkeyup=""search(this.value)"">
        <br> <br>
        <script>
        function search(val) {
                let str = val.toLowerCase().trim();
                let links = document.getElementsByTagName('a');
                for (let link of links) {
                        let text = link.innerText.toLowerCase();
                        if (text == '..') return;
                        if (str.length && text.indexOf(str) || !str) link.classList.remove('highlight');
                        else  link.classList.add('highlight');
                }
        }

        async function getList() {
                let blist = (await (await fetch('./backuplist')).text()).split('\n')
                for (let backup of blist) {
                      let a = document.createElement('a')
                      a.innerText = backup
                      a.href = './backups/' + backup
                          document.body.appendChild(a)
                          document.body.appendChild(document.createElement('br'))
                }
        }
        getList()
        </script>
        <style>
                .highlight {
                        border-radius: 4px;
                        background-color: yellow;
                        box-shadow: -2px -2px 4px darkkhaki inset;
                }
        </style>
";
const string indexTemplate = @"
        <h1>rPlace canvas file server is running.</h1>
        <p>Visit /place in order to fetch the active place file, /backuplist to view a list of all backups, and fetch from /backups/<span style=""background-color: lightgray; border-radius: 4px;"">place file name</span> to obtain a backup by it's filename (in backuplist).</p>
        <pre>
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠓⠒⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣀⠀⠀⠀⠀⠀⢠⢤⣤⣤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡠⠔⠒⠒⠲⠎⠀⠀⢹⡃⢀⣀⠀⠑⠃⠀⠈⢀⠔⠒⢢⠀⠀⠀⡖⠉⠉⠉⠒⢤⡀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠔⠚⠙⠒⠒⠒⠤⡎⠀⠀⠀⠀⢀⣠⣴⣦⠀⠈⠘⣦⠑⠢⡀⠀⢰⠁⠀⠀⠀⠑⠰⠋⠁⠀⠀⠀⠀⠀⠈⢦⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⠁⠀⠀⠀⠀⠀⠀⢰⠃⠀⣀⣀⡠⣞⣉⡀⡜⡟⣷⢟⠟⡀⣀⡸⠀⡎⠀⠀⠀⠀⠀⡇⠀⠀⠀⠀⠀⠀⠀⠀⣻⠀⠀⠀⠀
⢰⠂⠀⠀⠀⠀⠀⠀⠀⣗⠀⠀⢀⣀⣀⣀⣀⣀⣓⡞⢽⡚⣑⣛⡇⢸⣷⠓⢻⣟⡿⠻⣝⢢⠀⢇⣀⡀⠀⠀⠀⢈⠗⠒⢶⣶⣶⡾⠋⠉⠀⠀⠀⠀⠀
⠈⠉⠀⠀⠀⠀⠀⢀⠀⠈⠒⠊⠻⣷⣿⣚⡽⠃⠉⠀⠀⠙⠿⣌⠳⣼⡇⠀⣸⣟⡑⢄⠘⢸⢀⣾⠾⠥⣀⠤⠖⠁⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⢀⠀⠀
⠀⠀⠀⢰⢆⠀⢀⠏⡇⠀⡀⠀⠀⠀⣿⠉⠀⠀⠀⠀⠀⠀⠀⠈⢧⣸⡇⢐⡟⠀⠙⢎⢣⣿⣾⡷⠊⠉⠙⠢⠀⠀⠀⠀⠀⢸⡇⢀⠀⠀⠀⠀⠈⠣⡀
⠀⠀⠀⠘⡌⢣⣸⠀⣧⢺⢃⡤⢶⠆⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⣟⠋⢀⠔⣒⣚⡋⠉⣡⠔⠋⠉⢰⡤⣇⠀⠀⠀⠀⢸⡇⡇⠀⠀⠀⠀⠀⠀⠸
⠀⠀⠀⠀⠑⢄⢹⡆⠁⠛⣁⠔⠁⠀⣿⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⣿⢠⡷⠋⠁⠀⠈⣿⡇⠀⠀⠀⠈⡇⠉⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠑⣦⡔⠋⠁⠀⠀⠀⣿⠀⠀⢠⡀⢰⣼⡇⠀⡀⠀⠀⣿⠀⠁⠀⠀⠀⠀⣿⣷⠀⠀⠀⠀⡇⠀⠀⢴⣤⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢰⣿⡇⠀⠀⠀⠀⠀⣿⡀⠀⢨⣧⡿⠋⠀⠘⠛⠀⠀⣿⠀⠀⢀⠀⠀⠀⣿⣿⠀⠀⠀⠀⢲⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢸⣿⡇⠀⠀⠀⠀⠀⢸⡧⡄⠀⠹⣇⡆⠀⠀⠀⠀⠀⣿⠀⢰⣏⠀⣿⣸⣿⣿⠀⠀⠀⠀⣼⠀⠀⠰⠗⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢸⣿⡇⠀⠀⠀⠀⠀⢸⡇⣷⣛⣦⣿⢀⠈⠑⠀⢠⡆⣿⠐⢠⣟⠁⢸⠸⣿⣿⢱⣤⢀⠀⣼⠀⠀⢀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢸⣿⡇⠀⢀⠀⠀⠀⢸⡇⠘⠫⣟⡇⠊⣣⠘⠛⣾⡆⢿⠀⠙⣿⢀⣘⡃⣿⣿⡏⠉⠒⠂⡿⠀⠰⣾⡄⠀⢸⡟⣽⣀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠸⣿⡇⠀⠘⣾⠀⠀⢸⡇⢸⣇⡙⠣⠀⣹⣇⠀⠈⠧⢀⣀⣀⡏⣸⣿⣇⢹⣿⡇⢴⣴⣄⣀⡀⢰⣿⡇⠀⢸⣇⢿⡿⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠓⠁⠈⠻⢷⠾⠦⠤⠬⣅⣹⣿⣖⣶⣲⣈⡥⠤⠶⡖⠛⠒⠛⠁⠉⠛⠮⠐⢛⡓⠒⢛⠚⠒⠒⠒⠛⣚⣫⡼⠿⠿⣯⠛⠤⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠉⠉⠉⠉⡉⠉⠁⠀⠀⠘⠓⠀⠀⠀⠀⠀⣀⣞⡿⡉⠉⠉⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣶⠏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
        </pre>
        <h4 style=""margin: 0px;"">Other pages:</h4>    <a href=""place"">place</a>
        <a href=""backups"">backups</a>
        <a href=""backuplist"">backuplist</a>
        <br>
        <p>©Zekiah-A, BlobKat - rplace.tk ❤️</p>
";


app.MapGet("/", () => Results.Content(indexTemplate, "text/html", Encoding.Unicode));

app.MapGet("/place", () =>
{
        var stream = new FileStream(Path.Join(Directory.GetCurrentDirectory(), "place"), FileMode.Open);
        return Results.File(stream);
});

// Lists all available backups. 
app.MapGet("/backups", () => {
    return Task.FromResult(Results.Content(backuplistTemplate, "text/html"));
});

// To download a specific backup.
app.MapGet("/backups/{placeFile}", (string placeFile) =>
{
        var stream = new FileStream(Path.Join(Directory.GetCurrentDirectory(), placeFile), FileMode.Open);
        return Results.File(stream);
});

app.MapGet("/backuplist", async () =>
        await File.ReadAllTextAsync(Path.Join(Directory.GetCurrentDirectory(), "backuplist.txt"))
);


app.MapPost("/timelapse", async (TimelapseInformation timelapseInfo) =>
{
        var stream = await TimelapseGenerator.GenerateTimelapseAsync(timelapseInfo.BackupStart, timelapseInfo.BackupEnd, timelapseInfo.Fps, 750, timelapseInfo.StartX, timelapseInfo.StartY, timelapseInfo.EndX, timelapseInfo.EndY, timelapseInfo.Reverse);
        return Results.File(stream);
});

app.Run();
