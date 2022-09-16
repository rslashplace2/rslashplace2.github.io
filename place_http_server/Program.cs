using System.Net;
using System.Text;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using System;
using System.Text.Json;

namespace PlaceHttpServer;

public static class Program
{
	private static string Cert { get; } = "/path/to/your/cert.pem";
	private static string Key { get; } = "/path/to/your/key.pem";
	private static int Port { get; } = 8080;
	private static string ConfigFile => Path.Join(Directory.GetCurrentDirectory(), "config.txt");
	private static HttpListener? listener;

	private const string BackuplistTemplate = @"
		<h1>Rplace canvas place file/backup list.</h1>
		<p>See [domain-url]/backuplist.txt for cleanly formatted list of backups saved here.</p>
		<span style=""color: red;"">(Do not try to iterate directly through this directory with code, for the sake of your own sanity, please instead use plaintext [domain-url]/backuplist)</span>
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
		</script>
		<style>
			.highlight {
				border-radius: 4px;
				background-color: yellow;
				box-shadow: -2px -2px 4px darkkhaki inset;
			}
		</style>
	";

	static Program()
	{
		if (!File.Exists(ConfigFile))
		{
			File.WriteAllText(
				ConfigFile,
				"cert: " + Cert + Environment.NewLine + "key: " + Key + Environment.NewLine + "port: " + Port
			);
			Console.ForegroundColor = ConsoleColor.Green;
			Console.WriteLine("Config created! Please check {0} and run this program again!", ConfigFile);
			Console.ResetColor();
			Environment.Exit(0);
		}
		var config = File.ReadAllLines(ConfigFile);
		Cert = config[0].Split(":")[1];
		Key = config[1].Split(":")[1];
		Port = int.Parse(config[2].Split(":")[1]);
	}
	
	public static void Main(string[] args)
	{
		listener = new HttpListener();
		listener.Prefixes.Add("http://*:" + Port + "/");
		listener.Start();
		Console.ForegroundColor = ConsoleColor.Blue;
		Console.WriteLine("Server Started!");
		Console.ResetColor();

		var listenTask = HandleListen();
		listenTask.GetAwaiter().GetResult();
	}

	private static async Task HandleListen()
	{
		while (listener is {IsListening: true})
		{
			var ctx = await listener.GetContextAsync();
			var req = ctx.Request;
			var resp = ctx.Response;
			resp.AddHeader("Access-Control-Allow-Origin", "*");
			
			switch (req.HttpMethod)
			{
				case "GET":
					switch (req.Url?.AbsolutePath)
					{
						case "/":
							var send = Encoding.UTF8.GetBytes($"rPlace canvas file server is running. Visit [url-of-domain]:{Port}/place in order to fetch the active place file, [url-of-domain]{Port}/backuplist to view a list of all backups, and fetch from [url-of-domain]{Port}/backups to obtain a backup by it's filename (in backuplist)");
							resp.ContentType = "text/html";
							resp.ContentEncoding = Encoding.UTF8;
							resp.ContentLength64 = send.LongLength;
							await resp.OutputStream.WriteAsync(send);
							break;
						case "/place":
							var board = await File.ReadAllBytesAsync(Path.Join(Directory.GetCurrentDirectory(), "place"));
							resp.ContentLength64 = board.LongLength;
							await resp.OutputStream.WriteAsync(board);
							break;
						case "/backuplist":
							var list = Encoding.UTF8.GetBytes(await File.ReadAllTextAsync(Path.Join(Directory.GetCurrentDirectory(), "backuplist.txt")));
							resp.ContentType = "text/plain";
							resp.ContentEncoding = Encoding.UTF8;
							resp.ContentLength64 = list.Length;
							await resp.OutputStream.WriteAsync(list);
							break;
						case "/backups":
							var dir = Directory.GetFiles(Directory.GetCurrentDirectory()).ToList();
							for (var fn = 0; fn < dir.Count; fn++) 
								dir[fn] = $"<a href=\"{dir[fn]}\">{new DirectoryInfo(dir[fn]).Name}</a>";
							var backups = Encoding.UTF8.GetBytes(
								BackuplistTemplate +
								dir.Aggregate((a, b) => a + "<br>\n" + b)
							);
							resp.ContentType = "text/html";
							resp.ContentEncoding = Encoding.UTF8;
							resp.ContentLength64 = backups.Length;
							await resp.OutputStream.WriteAsync(backups);
							break;
					}
					break;
				
				case "POST":
					if (req.Url?.AbsolutePath == "/timelapse")
					{
						var obj = await JsonSerializer.DeserializeAsync<TimelapseInfo>(req.InputStream);
						if (obj is null) return;
						var lapse = await new TimelapseGen().GenerateTimelapse(obj.OutName, obj.BackupStart, obj.BackupEnd, obj.Fps, obj.SX, obj.SY, obj.EX, obj.EY);
						resp.ContentLength64 = lapse.Length;
						await resp.OutputStream.WriteAsync(lapse);
					}
					break;
				
			}
		}
	}
}

//string outName, string backupStart, string backupEnd, uint fps, int sX, int sY, int eX, int eY, int sizeX, int sizeY
public class TimelapseInfo
{
	public string OutName { get; set; }
	public string BackupStart { get; set; }
	public string BackupEnd { get; set; }
	public uint Fps { get; set; }
	public int SX { get; set; }
	public int SY { get; set; }
	public int EX { get; set; }
	public int EY { get; set; }
}
