# Compressor
## Filter Life Prediction
Compressor manufacturers usually publish guidelines for the expected
lifetime of the filters in their compressors. This normally includes a
<b>Predicted Filter Lifetime</b> for the filter when the compressor is run at a
typical temperature (e.g. 20&deg;C). Compressor filter performance
degrades significantly at higher temperatures (and generally improves
slightly at lower temperatures), so manufacturers usually publish a
curve indicating expected lifetime at different temperatures. This is
normally an exponential curve that can be modelled using a symmetric
sigmoidal curve
`F = D + (A - D) / (1 + (T / C) ^ B)` where T is the
temperature, F is a lifetime degradation factor, and A, B, C and D are
constant <b>Coefficients</b>. We can apply this to the predicted lifetime Lp to obtain a
predicted lifetime at that temperature in hours `Lpt = F * Lp`. For a
runtime of dT hours, we can then obtain an estimate of "filter lifetime used"
`Flu = dT / Lpt`. We then subtract that from `Lp` to get a new filter
life prediction. 

(Note: an improvement might be to make the prediction based on the average temperature of the last 5 runs, rather than the ideal temperature)

The default filter lifetime constants for the static compressor
prediction re derived from data provided by Coltri for an MCH 16/ET,
and for the portable compressor by Bauer for a PE100, though you can
provide your own coefficients to match your compressor/filters in the
settings dialog (http://www.mycurvefit.com provides a convenient way to fit a curve
to a set of data points)

## Operational Limits
The application automatically evaluates values of temperature and
humidity to determine whether it is safe to operate the compressor.

The lifetime of filters is mostly determined by the amount of water
that has to be removed from the air. The more water has to be removed,
the more saturated the dessicant in the filter becomes, until it can
no longer remove enough water. In an effort to maximise filter life, the
app will automatically restrict use of the compressor based on the
current temperature and humidity.

Going back to basics, the water vapour capacity of air is proportional
to temperature.

water vapour capacity (gm<sup>-3</sup>) = 1322.94948 * exp(T / (T + 238.3) * 17.2694) / (T + 273.16)

where T is the air temperature in &deg;C

Thus air at 20&deg;C will have a water vapour capacity of around
17g per m<sup>3</sup> at 1 bar. Since:

Relative Humidity (RH) = (Water vapour content / Water vapour capacity) * 100%

this is the water content at a RH of 100%.

At 20&deg;C, 80% humidity, the air contains 17*0.8 = 13.6gm<sup>-3</sup>.
At 50% humidity, 17*0.5 = 8.5gm<sup>-3</sup>

Let's say it's 80%RH and 20&deg;C. You are pumping a 10L cylinder to
232 bar, that is 2320 litres of air at 1 bar, or 2.32 m<sup>3</sup>,
which will contain 31.55g of water vapour. Since the dryness
requirement (for Nitrox) is 0.02gm<sup>-3</sup> (measured at 1 bar)
that means there can be no more than 0.046g of water in the filled
tank. So we have to remove 31.5g of water.

At 50%RH and 20&deg;C, you have to remove 19.67g.
Air of 80%RH at 10&deg;C, you have to remove 21.66g.
 
The reason the amount of water removed is important is that the
performance of the filtration system depends on it. Let's say you pump
at 300L per minute. That will fill a 12 from empty in roughly 9
minutes. So at 80% RH and 20&deg;C, you have to remove roughly 38g
(38ml) of water. You have to purge that water (condensate) from the
system, otherwise it pools at the base of the filter and saturates the
media, but every time you purge you lose pressure, which increases the
fill time.

So the threshold for compressor operation is a function of:
1. The <b>Maximum condensate</b> volume (in ml) which is acceptable between purges
2. The <b>Pumping rate<b> of the compressor (in litres per minute)
3. The <b>Purging frequency</b>, in minutes
4. The temperature and humidity (and atmospheric pressure, though the effect
of this is negligible)
The parameters controlling this calculation can be set up in the configuration dialog.