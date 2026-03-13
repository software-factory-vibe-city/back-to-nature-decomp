<!-- Document Release 1.0 for Run-time Library Release 4.7 -->
                                                          February. 2000

                                          PlayStation(R) Programmer Tool
                                             Runtime Library Release 4.7

                               Library Changes, New Additions, and Known
                                                        from Release 4.6
------------------------------------------------------------------------
                                                    All Rights Reserved.
                      Copyright(C) 2000 Sony Computer Entertainment Inc.
------------------------------------------------------------------------

Known Bugs and Cautions
------------------------------------------------------------------------
< Limitations on the HMD Library > 
- The environment map is provided as a Beta version, because the 
  format may change in future release without keeping compatibility.

  The Beta-version primitives are not officially supported by SCE at
  the moment. If you wish to use them for creating titles, please do
  so on your own responsibility.

< Limitations on Memory Card GUI Module >
- At the moment, the latest module cannot be utilized for the
  "CodeWarrior for PlayStation" of Metrowerks Inc. The module for the
  "CodeWarrior for PlayStation" is planned to be downloaded from the
  SCE-NET when it is available.

< Limitations on Extended Sound Library >
- In the Extended Sound Library, noise is not produced properly.
  Thererfore, when using noise, please use the Basic Sound Libraby
  (libspu).

All products and company names mentioned herein are the registered 
trademarks or trademarks of their respective owners.


SDevTC Tools
------------------------------------------------------------------------
< Files Changed >
pssn\readme_j.txt             version updated 
pssn\bin\aspsx.exe            version updated 
pssn\bin\cc1psx.exe           version updated 
pssn\bin\cc1plpsx.exe         version updated 
pssn\bin\cpppsx.exe           version updated 

< File Added >
pssn\gnusrc\gcc295s.zip       gcc 2.95 source (zip compression file)

< File Deleted >
pssn\gnusrc\gcc281s.zip       gcc 2.8.1 source (zip compression file)


Standard Header File
------------------------------------------------------------------------
< Header File Bug Fix >
- When using the following macro included in limits.h, a warning
  was displayed at compile time.  This problem has been fixed.
  (INT_MIN,UINT_MAX,LONG_MIN, ULONG_MAX)


Standard C Library (libc/libc2)
------------------------------------------------------------------------
< Library Bug Fix >
- With bcmp(), memcmp(), if the comparing size is 0, the return value
  was occasionally not 0.  This problem has been fixed.

- With strtol(), strtoul(), if NULL is passed to the second argument,
  the contents of the addres 0 was destroyed.  
  This problem has been fixed.


Extended CD-ROM Library (libds)
------------------------------------------------------------------------
< Library Bug Fix >
- After the execution of DsClose(), if executing DsInit() again,
  DsSearchFile() was incapable of exchanging discs.  This problem has
  been fixed.

- When making disc access with DsControl(), DsCommand() and DsPacket(),
  it was possible not to detect the termination of commands depending
  on the operation timing.  This problem has been fixed.


Basic Graphics Library (libgpu)
------------------------------------------------------------------------
< Library Bug Fix >
- When multiple streams were opened with FntOpen() and the maximum 
  number of characters are then displayed with FntPrint(), the other
  stream buffer was occasionaly destroyed because of this and FntPrint()
  was not operated properly.  This problem has been fixed.


Extended Graphics Library (libgs)
------------------------------------------------------------------------
< Library Bug Fix >
- When performing automatic division in GsA4divNG3() and GsA4divNG4(),
  it was not correctly drawn translucent.  This problem has been fixed.

- When performing automatic division in GsA4divTNF3(), GsA4divTNG3(), 
  GsA4divTNF4() and GsA4divTNG4(), it was drawn with shading off scheme. 
  This problem has been fixed.

- When performing automatic division in GsA4divNF3(), GsA4divNF4(),
  GsA4divG3L(), GsA4divG3LFG(), GsA4divG3NL(), GsA4divG4L(), 
  GsA4divG4LFG() and GsA4divG4NL(), the gap beteween
  the divided polygons were padded with the opaque polygons.  Those 
  polygons were replaced with the translucent ones to reflect the code 
  of the tmd data.


Controller Library (libpad)
------------------------------------------------------------------------
< Library Bug Fix >
- The V-BLANK interrupt which is an operation to communicate with the
  controller did not return.  This problem has been fixed.

- Although the above interrupt operation was returned, it was 
  occasionally blocked inside for the period of relatively long time.
  * These two symptoms can occur in both PadInitDirect and PadInitMtap.

- By the time it recognizes the controller with actuator (such as 
  DUALSHOCK) from the communication error state, the null pointer access
  was made.  This problem has been fixed.


Basic Sound Library (libspu)
------------------------------------------------------------------------
< Function Specification Changes >
- When reverb is set off in the library, it has been changed so that
  the depth is set to 0.


Extended Sound Library (libsnd)
------------------------------------------------------------------------
< Function Specification Changes >
- When reverb is set off in the library, it has been changed so that
  the depth is set to 0.


MEMORY CARD GUI Module (mcgui)
------------------------------------------------------------------------
< Function Specification Changes >
- In the second argument, mode, of McGuiSetExternalFont(), French, 
  German, Italian and Spanish are included in language mode on top of 
  English.

< Library Bug Fix >
- McGuiLoad() has been modified so that the icon data can be loaded
  to reflect the number of icon images.
