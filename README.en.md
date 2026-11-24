# Tonight’s Sky

What to see in the sky tonight from your city.

*Version française : [README.md](README.md)*

- **Tonight**: sunset and sunrise, each visible planet and the Moon, when it is highest and in which direction.
- **The sky as if you stepped outside**: a panorama toward one direction (drag to turn and look up), over 4,000 stars in their real colours, the Milky Way, the 88 constellations, the Moon and its phase, hour by hour.
- **ISS passes** over the next three nights (times within a few minutes).

Choose your city with the **City** button (Paris at first). Only the ISS orbit (celestrak.org) and the city lookup (open-meteo.com) come from the Internet. The **notifications** and **background tasks** permissions serve the ISS pass alerts, even with Sky closed.

## ISS alerts (new in 1.2.0)

Tick ALERT ME in the passes card: a notification comes before each pass of the space station (5 to 30 min before, all or only the fine ones), even with Sky closed.

## Info cards (1.1.0)

Click a planet, the Moon, the ISS, a bright star or a constellation (26 have a card) to open its card: what it is, what to look for, and where it is at the chosen time. The object is framed in the view.

The Tonight column puts the best sight first (the Moon, a bright planet, a fine ISS pass), one short line per object. Click a line to jump to that time and turn toward it.

## ISS pass alerts (1.2.0)

The space station is the easiest sight to see: a very bright dot crossing the sky in a few minutes, without blinking. In the **ISS PASSES** card:

- tick **ALERT ME**: a notification comes **5, 10, 15 or 30 min before** each pass, with the time, the direction where it appears, where it goes, and how high;
- choose **all passes**, **the fine ones** (over 30° high) or **the very fine ones** (over 50°);
- **TRY** sends a test notification right away.

The alert works even with Sky closed, as long as NeoDex is open (**background tasks** permission). A pass alerts only once, and not if the PC wakes up after it began. The orbit is read at most twice a day from CelesTrak; passes marked “alert” in the list are the ones that will alert you.
